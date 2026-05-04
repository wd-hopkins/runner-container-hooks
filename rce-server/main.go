package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/wd-hopkins/rce-agent"
)

func main() {
	port := flag.String("port", "9090", "Port to listen on")
	flag.Parse()

	addr := fmt.Sprintf(":%s", *port)

	cfg := rce.ServerConfig{
		Addr:            addr,
		AllowAnyCommand: true,
		DisableSecurity: true,
	}

	server := rce.NewServerWithConfig(cfg)

	if err := server.StartServer(); err != nil {
		log.Fatalf("failed to start rce-agent server: %v", err)
	}

	log.Printf("rce-agent server listening on %s", addr)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down server...")
	if err := server.StopServer(); err != nil {
		log.Fatalf("failed to stop rce-agent server: %v", err)
	}
	log.Println("server stopped")
}
