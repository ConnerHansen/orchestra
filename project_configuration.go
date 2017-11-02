package main

import (
	"math/rand"
	"time"
)

// ProjectConfiguration the struct for holding a particular set of configurations
type ProjectConfiguration struct {
	ID                string        `json:"id"`
	Name              string        `json:"name"`
	Description       string        `json:"description"`
	Services          []interface{} `json:"services"`
	TemporaryServices []interface{} `json:"-"` // TemporaryServices do not get saved
}

// GenerateID generates a new ID
func (p *ProjectConfiguration) GenerateID() {
	Info.Println("Generating ID")
	rand.Seed(time.Now().UnixNano())

	chars := make([]rune, 24)
	for i := range chars {
		chars[i] = letterRunes[rand.Intn(len(letterRunes))]
	}

	p.ID = string(chars)
}

// AddTemporaryService adds a new temporary service to this project
// configuration
func (p *ProjectConfiguration) AddTemporaryService(service map[string]interface{}) error {
	return nil
}

// Running returns whether or not the project is in a running state
func (p *ProjectConfiguration) Running() bool {
	for _, service := range p.Services {
		genericService := service.(ServiceInterface)
		// If any service is running, then the project is running
		if genericService.GetState() == ServiceRunning {
			return true
		}
	}

	return false
}

// Start starts the full project configuration
func (p *ProjectConfiguration) Start() bool {
	success := true
	for _, s := range p.Services {
		accepted := false
		service := s.(ServiceInterface)
		for _, iface := range ServiceInterfaces {
			if iface.Accept(service) {
				accepted = true
				if service.GetState() == ServiceRunning {
					// Already running, don't try to start it
				} else {
					success = success && service.Start()
				}

				if !success {
					Error.Println("There was an error starting up service:", service)
				} else {
					Debug.Println("Project start -- started", service)
				}
			}
		}

		// Make sure we flag something if start failed
		if !accepted {
			Error.Println("Cannot start unexpected service type:", service)
		}
	}

	Debug.Println("Project", p.Name, "started?", success)
	return success
}

// Stop stops the full project configuration
func (p *ProjectConfiguration) Stop() {
	for _, s := range p.Services {
		accepted := false
		service := s.(ServiceInterface)

		// Get the match here
		for _, iface := range ServiceInterfaces {
			if iface.Accept(service) {
				accepted = true
				service.Stop()
			}
		}

		if !accepted {
			Error.Println("Cannot stop unexpected service type:", service)
		}
	}

	Info.Println("Stopped the project configuration for", p.Name)
}

// Update updates the project configuration with settings from a new one
func (p *ProjectConfiguration) Update(newConfig *ProjectConfiguration) error {
	var err error

	if p.Running() {
		return ErrorCannotModifyProject
	}

	// We have to do an initial pass to make sure we don't *start* updating
	// and then run into an actively running service, so we have to do
	// this loop at least twice
	for _, s := range p.Services {
		service := s.(ServiceInterface)

		if service.GetState() == ServiceRunning {
			return ErrorCannotModifyService
		}
	}

	// So we changed the name, make sure we don't have anything else named
	// that same name yet
	if p.Name != newConfig.Name {
		for _, proj := range Config.Projects {
			if newConfig.Name == proj.Name {
				return ErrorNameAlreadyTaken
			}
		}

		p.Name = newConfig.Name
	}

	p.Description = newConfig.Description

	if p.ID == "" {
		p.GenerateID()
	}

	var newServices []interface{}
	for _, updateMap := range newConfig.Services {
		updatedService := updateMap.(map[string]interface{})

		// This is a new service, insert a new entry into the array
		if _, ok := updatedService["id"]; !ok {
			for _, iface := range ServiceInterfaces {
				if iface.Accept(updatedService) {
					newServices = append(newServices, iface.Create(updatedService, p))
				}
			}
		} else {
			matched := false
			for _, s := range p.Services {
				service := s.(ServiceInterface)

				for _, iface := range ServiceInterfaces {
					if iface.Accept(updatedService) && service.IsMatch(updatedService) {
						matched = true
						err = service.Update(updatedService)
						newServices = append(newServices, service)
					}
				}
			}

			// Log it, probably percolate a warning up to a user
			if !matched {
				Error.Println("Couldn't find a match for:", updatedService)
				err = ErrorCannotMatchService
			}
		}
	}

	p.Services = newServices
	return err
}
