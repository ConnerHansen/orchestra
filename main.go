package main

import (
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strings"
)

const (
	// EnvironmentDev dev env
	EnvironmentDev = "dev"

	// EnvironmentProd prod env
	EnvironmentProd = "production"

	// EnvironmentStaging staging env
	EnvironmentStaging = "staging"

	// EnvironmentVerification verification env
	EnvironmentVerification = "verification"
)

var (
	// Environment the environment we're running under. Assume we're in
	// dev mode if we aren't explicitly set to prod
	Environment = EnvironmentDev

	// OrchestraBuildVersion the current build version number -- this gets
	// overridden by the build script
	OrchestraBuildVersion = "0000000000"

	// OrchestraEnvVar the environment variable to use for setting the
	// current environment
	OrchestraEnvVar = "ORCH_ENV"

	// OrchestraVersion the current version of Orchestra
	OrchestraVersion = "0.2.1"
)

//go:generate go-bindata -o assets.go assets/...

func main() {
	OrchestraVersion = fmt.Sprint(OrchestraVersion, ".", OrchestraBuildVersion)
	if os.Getenv(OrchestraEnvVar) != "" {
		// Make sure the casing is what we expect too
		Environment = strings.ToLower(os.Getenv(OrchestraEnvVar))
	}

	// Setup the loggers
	SetupLoggers()

	Info.Printf("Starting up Orchestra v.%s\n", OrchestraVersion)
	Config = loadConfiguration(DefaultConfigName)
	Info.Println("Starting up with config:", Config)

	go func() {
		if Config.Server.AcceptAddrHTTPS != "" {
			Error.Fatal(http.ListenAndServeTLS(Config.Server.GetHTTPSUrl(),
				"ssl/server.crt", "ssl/server.key", buildMux()))
		}
	}()

	if !Config.Server.HTTPSOnly {
		go func() {
			Error.Fatal(http.ListenAndServe(Config.Server.AcceptAddr+Config.Server.Port, buildMux()))
		}()
	}

	// TODO: remove this when you have time, the channel isn't used anymore
	go listenForProcessData()

	for _, arg := range os.Args {
		if arg == "--open" {
			cmd := exec.Command("open", "http://localhost"+Config.Server.Port)
			cmd.Start()
		}
	}

	waitForHalt()

	for _, project := range Config.Projects {
		Debug.Println("Halting", project.Name)
		if project.Running() {
			project.Stop()
		}
	}

	Info.Println("Shutting down...")
}
