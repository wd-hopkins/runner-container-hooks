import * as fs from 'fs'
import { cleanupJob, prepareJob, runScriptStep } from '../src/hooks'
import { portForward, TestHelper } from './test-setup'
import { PrepareJobArgs, RunScriptStepArgs } from 'hooklib'
import * as net from 'node:net'

jest.useRealTimers()

let testHelper: TestHelper

let prepareJobOutputData: any

let runScriptStepDefinition: {
  args: RunScriptStepArgs
}

describe('Run script step', () => {
  beforeEach(async () => {
    testHelper = new TestHelper()
    await testHelper.initialize()
    const prepareJobOutputFilePath = testHelper.createFile(
      'prepare-job-output.json'
    )

    const prepareJobData = testHelper.getPrepareJobDefinition()
    runScriptStepDefinition = testHelper.getRunScriptStepDefinition() as {
      args: RunScriptStepArgs
    }

    await prepareJob(
      prepareJobData.args as PrepareJobArgs,
      prepareJobOutputFilePath
    )
    const outputContent = fs.readFileSync(prepareJobOutputFilePath)
    prepareJobOutputData = JSON.parse(outputContent.toString())
  })

  afterEach(async () => {
    await cleanupJob()
    await testHelper.cleanup()
  })

  // NOTE: To use this test, do kubectl apply -f podspec.yaml (from podspec examples)
  // then change the name of the file to 'run-script-step-test.ts' and do
  // npm run test run-script-step

  it('should not throw an exception', async () => {
    await expect(
      runScriptStep(runScriptStepDefinition.args, prepareJobOutputData.state)
    ).resolves.not.toThrow()
  })

  it('should fail if the working directory does not exist', async () => {
    runScriptStepDefinition.args.workingDirectory = '/foo/bar'
    await expect(
      runScriptStep(runScriptStepDefinition.args, prepareJobOutputData.state)
    ).rejects.toThrow()
  })

  it('should shold have env variables available', async () => {
    runScriptStepDefinition.args.entryPoint = 'bash'

    runScriptStepDefinition.args.entryPointArgs = [
      '-c',
      "'if [[ -z $NODE_ENV ]]; then exit 1; fi'"
    ]
    await expect(
      runScriptStep(runScriptStepDefinition.args, prepareJobOutputData.state)
    ).resolves.not.toThrow()
  })

  it('Should have path variable changed in container with prepend path string', async () => {
    runScriptStepDefinition.args.prependPath = ['/some/path']
    runScriptStepDefinition.args.entryPoint = '/bin/bash'
    runScriptStepDefinition.args.entryPointArgs = [
      '-c',
      `'if [[ ! $(env | grep "^PATH=") = "PATH=${runScriptStepDefinition.args.prependPath}:"* ]]; then exit 1; fi'`
    ]

    await expect(
      runScriptStep(runScriptStepDefinition.args, prepareJobOutputData.state)
    ).resolves.not.toThrow()
  })

  it('Dollar symbols in environment variables should not be expanded', async () => {
    runScriptStepDefinition.args.environmentVariables = {
      VARIABLE1: '$VAR',
      VARIABLE2: '${VAR}',
      VARIABLE3: '$(VAR)'
    }
    runScriptStepDefinition.args.entryPointArgs = [
      '-c',
      '\'if [[ -z "$VARIABLE1" ]]; then exit 1; fi\'',
      '\'if [[ -z "$VARIABLE2" ]]; then exit 2; fi\'',
      '\'if [[ -z "$VARIABLE3" ]]; then exit 3; fi\''
    ]

    await expect(
      runScriptStep(runScriptStepDefinition.args, prepareJobOutputData.state)
    ).resolves.not.toThrow()
  })

  it('Should have path variable changed in container with prepend path string array', async () => {
    runScriptStepDefinition.args.prependPath = ['/some/other/path']
    runScriptStepDefinition.args.entryPoint = '/bin/bash'
    runScriptStepDefinition.args.entryPointArgs = [
      '-c',
      `'if [[ ! $(env | grep "^PATH=") = "PATH=${runScriptStepDefinition.args.prependPath.join(
        ':'
      )}:"* ]]; then exit 1; fi'`
    ]

    await expect(
      runScriptStep(runScriptStepDefinition.args, prepareJobOutputData.state)
    ).resolves.not.toThrow()
  })
})

// Skipping until rce-server image is available in CI
describe('Run script step with RCE', () => {
  let portForwardServer: net.Server
  const portForwardUrl = 'http://localhost:3334'

  beforeEach(async () => {
    process.env['RUNNER_HOOK_RCE_ENABLED'] = 'true'
    testHelper = new TestHelper()
    await testHelper.initialize()
    const prepareJobOutputFilePath = testHelper.createFile(
      'prepare-job-output.json'
    )

    const prepareJobData = testHelper.getPrepareJobDefinition()
    runScriptStepDefinition = testHelper.getRunScriptStepDefinition() as {
      args: RunScriptStepArgs
    }

    await prepareJob(
      prepareJobData.args as PrepareJobArgs,
      prepareJobOutputFilePath
    )
    const outputContent = fs.readFileSync(prepareJobOutputFilePath)
    prepareJobOutputData = JSON.parse(outputContent.toString())

    portForwardServer = await portForward(
      prepareJobOutputData.state.jobPod,
      3334,
      33333
    )
  })

  afterEach(async () => {
    if (portForwardServer) {
      portForwardServer.close()
    }
    await cleanupJob()
    await testHelper.cleanup()
    delete process.env['RUNNER_HOOK_RCE_ENABLED']
  })

  it('should not throw an exception', async () => {
    await expect(
      runScriptStep(
        runScriptStepDefinition.args,
        prepareJobOutputData.state,
        portForwardUrl
      )
    ).resolves.not.toThrow()
  })
})
