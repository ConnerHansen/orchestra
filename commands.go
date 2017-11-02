package main

import (
	"encoding/json"
)

// Command constants
const (
	CommandMockeryTestStart = "mockery_test_start"
	CommandListProjects     = "list_projects"
	CommandNew              = "new"
	CommandRemoveProject    = "remove_project"
	CommandRestart          = "restart"
	CommandStart            = "start"
	CommandStop             = "stop"
	CommandUpdate           = "update"
	CommandSetActiveConfig  = "set_active_configuration"
)

// processCommand attempts to figure out what the hell to do with
// a given command
func processCommand(entry IncomingSocketCommand, user *User) {
	switch entry.Type {
	// case CommandNew:
	// 	performNew(entry)
	case CommandListProjects:
		performListProjects(entry, user)
	case CommandStart:
		performStart(entry)
	case CommandStop:
		performStop(entry)
	case CommandRemoveProject:
		performRemoveProject(entry)
	case CommandSetActiveConfig:
		performSetActiveConfig(entry)
	case CommandUpdate:
		performUpdate(entry)
	default:
		Info.Println("Unknown command")
	}
}

// performListProjects will list all of the known projects to the consumer
func performListProjects(entry IncomingSocketCommand, user *User) {
	user.WriteJSON("project_list", Config.Projects)
	dumpExistingData(user)
}

func performSetActiveConfig(entry IncomingSocketCommand) {
	project := findProject(entry)

	if project != nil {
		matched := false
		for _, service := range project.Services {
			switch service.(type) {
			case *MockeryServiceConfiguration:
				mockable := service.(*MockeryServiceConfiguration)
				if mockable.GetID() == entry.ServiceID {
					matched = true
					activeIndex := int(entry.Data[0].(float64))
					// Found a match!
					if len(mockable.Configurations) > activeIndex {
						for i, currConfig := range mockable.Configurations {
							if i == activeIndex {
								currConfig.Active = true
							} else {
								// Make sure we set everyone else to false
								currConfig.Active = false
							}
						}
					}
				}
			}
		}

		if !matched {
			Error.Println("Could not find a matching service for", entry)
		} else {
			broadcastProjectUpdate(project)
		}
	} else {
		Error.Println("Cannot update project:", entry)
	}
}

// findProject attempts to locate the desired project in the set of known
// projects, otherwise it returns nil
func findProject(entry IncomingSocketCommand) *ProjectConfiguration {
	for _, project := range Config.Projects {
		// Don't die on the original config format
		if project.ID == entry.ProjectID || project.Name == entry.ProjectID {
			return project
		}
	}

	return nil
}

// performStart will attempt to start a given service
func performStart(entry IncomingSocketCommand) {
	project := findProject(entry)

	if project != nil {
		if entry.ServiceID == "" {
			Debug.Println("Starting project", project.Name)
			project.Start()
		} else {
			matched := false
			for _, service := range project.Services {
				// Test to make sure we actually ran
				if performAction(entry, service, project, CommandStart) {
					matched = true
					break
				}
			}

			if !matched {
				Error.Println("Could not find a matching service for", entry)
			}
		}
	} else {
		Error.Println("Could not find matching project", entry.ProjectID)
	}
}

// performStop will attempt to stop a given service
func performStop(entry IncomingSocketCommand) {
	project := findProject(entry)

	if project != nil {
		matched := false
		for _, service := range project.Services {
			if entry.ServiceID == "" {
				Debug.Println("Stopping project", project.Name)
				project.Stop()
				matched = true
				break
			} else {
				// Test to make sure we actually ran
				if performAction(entry, service, project, CommandStop) {
					matched = true
					break
				}
			}
		}

		if !matched {
			Error.Println("Could not find a matching service for", entry)
		}
	} else {
		Error.Println("Could not find matching project", entry.ProjectID)
	}
}

// performRemoveProject will attempt to start a given service
func performRemoveProject(entry IncomingSocketCommand) {
	project := findProject(entry)

	if project != nil {
		delete(Config.Projects, project.ID)
		Config.Save()
		broadcastProjectRemoval(project)
	} else {
		Error.Println("Could not find matching project", entry.ProjectID)
	}
}

func performUpdate(entry IncomingSocketCommand) {
	project := findProject(entry)

	if project != nil {
		matched := false
		for _, service := range project.Services {
			if entry.ServiceID == "" {
				Debug.Println("Updating project", project.Name)
				var config *ProjectConfiguration
				data, _ := json.Marshal(entry.Data[0])
				json.Unmarshal(data, &config)

				project.Update(config)
				matched = true
				break
			} else {
				// Test to make sure we actually ran
				if performAction(entry, service, project, CommandUpdate) {
					matched = true
					break
				}
			}
		}

		if !matched {
			Error.Println("Could not find a matching service for", entry)
		}
	} else {
		Error.Println("Could not find matching project", entry.ProjectID)
	}
}

func performAction(entry IncomingSocketCommand, srvc interface{}, project *ProjectConfiguration, action string) bool {
	matched := false

	if service, ok := srvc.(ServiceInterface); ok {
		for _, iface := range ServiceInterfaces {
			if iface.Accept(service) && service.IsMatch(entry.ServiceID) {
				switch action {
				case CommandStart:
					service.Start()
				case CommandStop:
					service.Stop()
				case CommandUpdate:
					service.Update(entry.Data[0].(map[string]interface{}))
				}

				matched = true
				break
			}
		}
	}

	return matched
}
