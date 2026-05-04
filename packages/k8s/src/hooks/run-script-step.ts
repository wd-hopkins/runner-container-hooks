/* eslint-disable @typescript-eslint/no-unused-vars */
import * as fs from 'fs'
import * as core from '@actions/core'
import { RunScriptStepArgs } from 'hooklib'
import { execCpFromPod, execCpToPod, execPodStep, namespace } from '../k8s'
import { writeRunScript, sleep, listDirAllCommand } from '../k8s/utils'
import { JOB_CONTAINER_NAME } from './constants'
import { dirname } from 'path'
import * as shlex from 'shlex'
import {
  ChannelCredentials,
  createChannel,
  createClientFactory,
  Metadata
} from 'nice-grpc'
import { RCEAgentDefinition, STATE, Status } from '../rce/rce'

export async function runScriptStep(
  args: RunScriptStepArgs,
  state,
  rpcServerUrl?: string
): Promise<void> {
  // Write the entrypoint first. This will be later coppied to the workflow pod
  const { entryPoint, entryPointArgs, environmentVariables } = args
  const { containerPath, runnerPath } = writeRunScript(
    args.workingDirectory,
    entryPoint,
    entryPointArgs,
    args.prependPath,
    environmentVariables
  )

  const workdir = dirname(process.env.RUNNER_WORKSPACE as string)
  const runnerTemp = `${workdir}/_temp`
  const containerTemp = '/__w/_temp'
  const containerTempSrc = '/__w/_temp_pre'
  // Ensure base and staging dirs exist before copying
  await execPodStep(
    [
      'sh',
      '-c',
      'mkdir -p /__w && mkdir -p /__w/_temp && mkdir -p /__w/_temp_pre'
    ],
    state.jobPod,
    JOB_CONTAINER_NAME
  )
  await execCpToPod(state.jobPod, runnerTemp, containerTempSrc)

  // Copy GitHub directories from temp to /github
  // Merge strategy:
  // - Overwrite files in _runner_file_commands
  // - Append files not already present elsewhere
  const mergeCommands = [
    'set -e',
    'mkdir -p /__w/_temp /__w/_temp_pre',
    'SRC=/__w/_temp_pre',
    'DST=/__w/_temp',
    // Overwrite _runner_file_commands
    'cp -a "$SRC/_runner_file_commands/." "$DST/_runner_file_commands"',
    `find "$SRC" -type f ! -path "*/_runner_file_commands/*" -exec sh -c '
    rel="\${1#$2/}"
    target="$3/$rel"
    mkdir -p "$(dirname "$target")"
    cp -a "$1" "$target"
  ' _ {} "$SRC" "$DST" \\;`,
    // Remove _temp_pre after merging
    'rm -rf /__w/_temp_pre'
  ]

  try {
    await execPodStep(
      ['sh', '-c', mergeCommands.join(' && ')],
      state.jobPod,
      JOB_CONTAINER_NAME
    )
  } catch (err) {
    core.debug(`Failed to merge temp directories: ${JSON.stringify(err)}`)
    const message = (err as any)?.response?.body?.message || err
    throw new Error(`failed to merge temp dirs: ${message}`)
  }

  // Execute the entrypoint script
  args.entryPoint = 'sh'
  args.entryPointArgs = ['-e', containerPath]
  try {
    if (process.env.RUNNER_HOOK_RCE_ENABLED === 'true') {
      await runEntrypointScriptOverRPC(args, state, rpcServerUrl)
    } else {
      await execPodStep(
        [args.entryPoint, ...args.entryPointArgs],
        state.jobPod,
        JOB_CONTAINER_NAME
      )
    }
  } catch (err) {
    core.debug(`execPodStep failed: ${JSON.stringify(err)}`)
    const message = (err as any)?.response?.body?.message || err
    throw new Error(`failed to run script step: ${message}`)
  } finally {
    try {
      fs.rmSync(runnerPath, { force: true })
    } catch (removeErr) {
      core.debug(`Failed to remove file ${runnerPath}: ${removeErr}`)
    }
  }

  try {
    core.debug(
      `Copying from job pod '${state.jobPod}' ${containerTemp} to ${runnerTemp}`
    )
    await execCpFromPod(
      state.jobPod,
      `${containerTemp}/_runner_file_commands`,
      `${workdir}/_temp`
    )
  } catch (error) {
    core.warning('Failed to copy _temp from pod')
  }
}

async function runEntrypointScriptOverRPC(
  args: RunScriptStepArgs,
  state,
  rpcServerUrl?: string
): Promise<void> {
  if (!rpcServerUrl) {
    rpcServerUrl = `svc-${state.jobPod}.${namespace()}.svc.cluster.local`
  }

  const channel = createChannel(
    rpcServerUrl,
    ChannelCredentials.createInsecure()
  )

  const authToken: string = state.authToken
  const client = createClientFactory()
    .use((call, options) =>
      call.next(call.request, {
        ...options,
        metadata: Metadata(options.metadata).set(
          'Authorization',
          `Bearer ${authToken}`
        )
      })
    )
    .create(RCEAgentDefinition, channel)

  let finalStatus: Status | undefined
  for await (const status of client.exec({
    Name: args.entryPoint,
    Arguments: args.entryPointArgs
  })) {
    finalStatus = status
    if (status.Stdout.length > 0) {
      core.info(status.Stdout.join('\n').trim())
    }
    if (status.Stderr.length > 0) {
      core.info(status.Stderr.join('\n').trim())
    }
  }

  if (finalStatus?.State === STATE.FAIL) {
    throw new Error(
      `failed to run script step: command exited with error code: ${finalStatus.ExitCode}`
    )
  }
}
