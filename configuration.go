package main

import (
	"encoding/json"
	"io/ioutil"
	"log"
	"os"
	"os/user"
)

// Configuration is the configuration struct for orchestra
type Configuration struct {
	// Projects map[string]ProjectConfiguration `json:"projects"`
	Projects map[string]*ProjectConfiguration `json:"projects"`
	Server   ServerConfiguration              `json:"server"`
	Source   string                           `json:"-"`
}

// ServerConfiguration the configuration for the server
type ServerConfiguration struct {
	AcceptAddr      string `json:"accept_addr"`
	AcceptAddrHTTPS string `json:"accept_addr_ssl"`
	LogLevel        string `json:"log_level"`
	Port            string `json:"port"`
	PortHTTPS       string `json:"port_ssl"`
	ShellExe        string `json:"shell_exe" default:"bash"`
	HTTPSOnly       bool   `json:"https_only"`
}

var (
	// Config the global configuration
	Config *Configuration

	// DefaultConfigName the default name for the configuration file
	DefaultConfigName = "config.json"

	// DefaultHomePath the default home directory path
	DefaultHomePath = ".orchestra"

	// DefaultLocalConfigName the default name for the local config file
	DefaultLocalConfigName = "local_config.json"

	// TypeRunnableService the runnable service type
	TypeRunnableService = "runnable_service_configuration"

	// TypeMockeryService the mockery service type
	TypeMockeryService = "mockery_service_configuration"

	// ServiceInterfaces the set of possible service interfaces
	ServiceInterfaces = map[string]ServiceInterface{
		TypeMockeryService:  &MockeryServiceConfiguration{},
		TypeRunnableService: &RunnableServiceConfiguration{},
	}
)

var (
	// DefaultConfiguration the default configuration for orchestra
	DefaultConfiguration = Configuration{
		Projects: map[string]*ProjectConfiguration{
			"Test": &ProjectConfiguration{
				ID:   GenerateServiceID(),
				Name: "Test",
				Services: []interface{}{
					&RunnableServiceConfiguration{
						ID:       GenerateServiceID(),
						Name:     "Hello World",
						Commands: []string{"echo 'hello world'"},
						Type:     "runnable_service_configuration",
					}}}},
		Server: ServerConfiguration{
			AcceptAddr:      "localhost",
			AcceptAddrHTTPS: "localhost",
			LogLevel:        "debug",
			Port:            ":8080",
			PortHTTPS:       ":8443",
			ShellExe:        "bash"}}
)

func loadConfiguration(configName string) *Configuration {
	var config Configuration
	path := getHomeDir() + "/" + DefaultHomePath

	if configName == "" {
		configName = DefaultConfigName
	}
	configPath := path + "/" + configName

	if _, err := os.Stat(path); err != nil {
		Debug.Println("Creating home directory")
		err = os.Mkdir(path, 0775)
		if err != nil {
			log.Fatal(err)
		}
	}

	if _, err := os.Stat(configPath); err != nil {
		Info.Println("Could not find a configuration file, creating default config")
		config = DefaultConfiguration
		if err != nil {
			Error.Println(err)
		}
	} else {
		Info.Println("Configuration file found, reading in")
		data, err := ioutil.ReadFile(configPath)
		if err != nil {
			Error.Println(err)
		}

		err = json.Unmarshal(data, &config)
		if err != nil {
			Error.Println(err)
			return nil
		}

		// Make sure we setup the HTTPS endpoints appropriately
		if config.Server.AcceptAddrHTTPS == "" {
			config.Server.AcceptAddrHTTPS = DefaultConfiguration.Server.AcceptAddrHTTPS
			config.Server.PortHTTPS = DefaultConfiguration.Server.PortHTTPS
		}
	}

	for key, project := range config.Projects {
		if project.ID == "" {
			project.GenerateID()
		}

		for sIndex, service := range project.Services {
			// Only attempt to convert this to a service interface if it's currently
			// a map (which means we're loading rather than just using the default)
			if currService, ok := service.(map[string]interface{}); ok {
				matched := false

				for _, iface := range ServiceInterfaces {
					if iface.Accept(currService) {
						matched = true
						project.Services[sIndex] = iface.Create(currService, project)
					}
				}

				if !matched {
					Error.Println("Could not match service entry:", currService)
				}
			} else {
				service.(ServiceInterface).SetProject(project)
			}
		}

		config.Projects[key] = project
	}

	config.Source = configPath
	err := config.Save()
	if err != nil {
		Error.Println(err)
	}

	return &config
}

func getHomeDir() string {
	dir := ""

	usr, err := user.Current()
	if err != nil {
		Error.Println(err)
	} else {
		dir = usr.HomeDir
	}

	return dir
}

// Save saves the current configuration out
func (c *Configuration) Save() error {
	data, err := json.Marshal(c)
	if err != nil {
		Error.Println(err)
	}

	return ioutil.WriteFile(c.Source, data, 0644)
}

// GetHTTPSUrl returns the full HTTPS url for this server
func (s *ServerConfiguration) GetHTTPSUrl() string {
	return s.AcceptAddrHTTPS + s.PortHTTPS
}
