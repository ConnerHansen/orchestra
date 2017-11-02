package main

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path"
	"runtime"
	"strings"
	"sync"
	"syscall"
)

var (
	emptyJSON = make(map[string]string)
)

func buildMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/logs", HandleLogs)
	mux.HandleFunc("/api/v1/projects", HandleProjects)
	mux.HandleFunc("/api/v1/project/", HandleProjectCrud)
	mux.HandleFunc("/api/v1/service/", HandleServiceCrud)
	mux.HandleFunc("/ws", HandleWebsocket)
	mux.HandleFunc("/login", HandleLogin)

	if Environment == EnvironmentProd {
		// TODO: productionize handling of the /app route
		mux.HandleFunc("/app/", HandleApp)
		mux.HandleFunc("/css/", HandleResources)
		mux.HandleFunc("/fonts/", HandleResources)
		mux.HandleFunc("/js/", HandleResources)
		mux.HandleFunc("/views/", HandleResources)
		mux.HandleFunc("/", HandleRoot)
	} else {
		mux.HandleFunc("/app/", HandleApp)
		mux.Handle("/css/", http.StripPrefix("/css/", http.FileServer(http.Dir("./assets/css"))))
		mux.Handle("/fonts/", http.StripPrefix("/fonts/", http.FileServer(http.Dir("./assets/fonts"))))
		mux.Handle("/js/", http.StripPrefix("/js/", http.FileServer(http.Dir("./assets/js"))))
		mux.Handle("/views/", http.StripPrefix("/views/", http.FileServer(http.Dir("./assets/views"))))
		mux.HandleFunc("/", HandleRootDev)
	}

	return mux
}

// HandleApp handles all /app/ routes
func HandleApp(rw http.ResponseWriter, req *http.Request) {
	// TODO: integrate webpack into the dev environment so I don't have to
	// roll my own here
	if req.RequestURI == "/app/orchestra.js" {
		data := buildOrchestra()
		rw.Header().Set("Content-Type", "text/javascript")
		rw.Write(data)
	} else if req.RequestURI == "/app/mockery.js" {
		data := buildMockery()
		rw.Header().Set("Content-Type", "text/javascript")
		rw.Write(data)
	} else {
		rw.WriteHeader(http.StatusNotFound)
	}
}

// HandleBadRequest is the default handler for writing out our normal error
// responses
func HandleBadRequest(rw http.ResponseWriter) {
	rw.WriteHeader(http.StatusUnauthorized)
}

// HandleGoodLogin handles a login request that looks like a valid attempt
func HandleGoodLogin(rw http.ResponseWriter, login *UserLogin) {
	user := NewUser(nil)
	user.Username = login.Username
	loggedInUsers.Set(user.Username, user)

	json.NewEncoder(rw).Encode(map[string]interface{}{
		"meta": map[string]string{
			"token": user.TokenString(),
		},
	})
}

// HandleLogin handles the login event
func HandleLogin(rw http.ResponseWriter, req *http.Request) {
	if req.Method == http.MethodPost {
		Debug.Println("Login!")
		body, err := ioutil.ReadAll(req.Body)

		if err != nil {
			HandleBadRequest(rw)
			rw.WriteHeader(http.StatusUnauthorized)
			return
		}

		defer req.Body.Close()
		var login *UserLogin

		err = json.Unmarshal(body, &login)
		if err != nil {
			Error.Println("There was an error getting the response:", err)
			HandleBadRequest(rw)
			return
		}

		if _, ok := loggedInUsers.Get(login.Username); ok {
			// Already logged in (plus they passed auth), just send back an OK
			// json.NewEncoder(rw).Encode(emptyJSON)

			// Patch to make sure things still work while we're finishing up
			// the auth components
			HandleGoodLogin(rw, login)
		} else {
			HandleGoodLogin(rw, login)
		}
	} else {
		HandleBadRequest(rw)
	}
}

// HandleResources blah
func HandleResources(rw http.ResponseWriter, req *http.Request) {
	path := req.RequestURI

	// Load the assets from the generated assets.go file
	data, err := Asset("assets" + path)
	if err != nil {
		Error.Println(err)
	} else {
		if strings.HasPrefix(path, "/css") {
			rw.Header().Set("Content-Type", "text/css")
		} else if strings.HasPrefix(path, "/fonts") {
			rw.Header().Set("Content-Type", "application/font")
		} else {
			if strings.HasPrefix(path, "/js") {
				rw.Header().Set("Content-Type", "text/javascript")
			} else {
				rw.Header().Set("Content-Type", "text/html")
			}
		}
		rw.Write(data)
	}
}

// HandleLogs handles the log route, what do you think it does
func HandleLogs(rw http.ResponseWriter, req *http.Request) {
	rw.WriteHeader(http.StatusInternalServerError)
}

// HandleProjects returns the set of available projects
func HandleProjects(rw http.ResponseWriter, req *http.Request) {
	json.NewEncoder(rw).Encode(Config.Projects)
}

// HandleProjectCrud handles the CRUD operations for projects
func HandleProjectCrud(rw http.ResponseWriter, req *http.Request) {
	defer req.Body.Close()

	// Get the project ID off of the path
	projectName := path.Base(req.RequestURI)

	if req.Method == http.MethodGet {
		json.NewEncoder(rw).Encode(Config.Projects[projectName])
	} else {
		var config *ProjectConfiguration
		data, _ := ioutil.ReadAll(req.Body)

		Debug.Println("Got update", string(data))
		err := json.Unmarshal(data, &config)

		if err != nil {
			handleBadRequest(rw, req, err, string(data))
		} else {
			statusReport := &ErrorReport{}
			if !handleProjectUpdate(statusReport, config) {
				handleProjectCreation(config)
			}

			// Are we returning something that's a full error?
			if statusReport.Level == ErrorLevelError {
				rw.WriteHeader(http.StatusInternalServerError)
			}

			json.NewEncoder(rw).Encode(statusReport)
		}
	}
}

// HandleRoot does rooty stuff
func HandleRoot(rw http.ResponseWriter, req *http.Request) {
	// Uhhh... I think we should run the template processing on startup, then
	// just store that as a byte array or something
	data, err := Asset("assets/views/index.html")
	if err != nil {
		Error.Println(err)
	} else {
		rw.Header().Set("Content-Type", "text/html")
		rw.Write(data)
	}
}

// HandleRootDev handles the root index file and serves a fresh copy for
// every request
func HandleRootDev(rw http.ResponseWriter, req *http.Request) {
	t := template.New("index.html")
	templ, err := t.ParseFiles("assets/views/index.html")
	if err != nil {
		Error.Println("Error", err)
		rw.WriteHeader(http.StatusInternalServerError)
	} else {
		err := templ.Execute(rw, struct{ OrchestraVersion string }{OrchestraVersion: OrchestraVersion})
		if err != nil {
			Error.Println("Error", err)
			rw.WriteHeader(http.StatusNotFound)
		}
	}
}

// HandleServiceCrud handles the CRUD operations for services
func HandleServiceCrud(rw http.ResponseWriter, req *http.Request) {
	defer req.Body.Close()

	// Get the project ID off of the path
	serviceID := path.Base(req.RequestURI)
	service, err := findService(serviceID)

	if err != nil {
		rw.WriteHeader(http.StatusInternalServerError)
		return
	}

	if req.Method == http.MethodGet {
		json.NewEncoder(rw).Encode(service)
	} else {
		// Has to be generic, since we don't know what kind of service it is
		var config map[string]interface{}
		data, _ := ioutil.ReadAll(req.Body)

		Debug.Println("Got service update", string(data))
		err := json.Unmarshal(data, &config)

		if err != nil {
			handleBadRequest(rw, req, err, string(data))
		} else {
			err := service.Update(config)
			if err != nil {
				Error.Println("Error while updating service")
				json.NewEncoder(rw).Encode(&ErrorReport{
					Level:   ErrorLevelError,
					Message: err.Error(),
					Type:    ErrorTypeUpdateFailure,
				})
			} else {
				broadcastProjectUpdate(service.GetProject())
				json.NewEncoder(rw).Encode(&ErrorReport{})
			}
		}
	}
}

//////////////////////////////////////
// SUPPORT FUNCTIONS
//////////////////////////////////////

func findService(serviceID string) (ServiceInterface, error) {
	for _, proj := range Config.Projects {
		for _, serviceBlob := range proj.Services {
			service := serviceBlob.(ServiceInterface)

			if service.GetID() == serviceID {
				if service.GetState() == ServiceRunning {
					return service, ErrorCannotModifyService
				}

				return service, nil
			}
		}
	}

	return nil, ErrorCannotMatchService
}

// handleBadRequest is a generic error reporter for when something in the request
// fails to parse appropriately
func handleBadRequest(rw http.ResponseWriter, req *http.Request, err error, data string) {
	Error.Println("Couldn't understand the payload:", err, string(data), req.Header)

	// Tell the world
	rw.WriteHeader(http.StatusInternalServerError)
	json.NewEncoder(rw).Encode(&ErrorReport{
		Level:   ErrorLevelError,
		Message: err.Error(),
		Type:    ErrorTypeGenericError})
}

// handleProjectCreation takes in an update and assigns it to a new project
// entry in the configuration
func handleProjectCreation(update *ProjectConfiguration) {
	newProject := &ProjectConfiguration{}
	newProject.Update(update)
	for _, user := range activeUsers {
		user.Subscribe(newProject)
	}

	Debug.Println("Created new project:", newProject)
	Config.Projects[newProject.ID] = newProject
	Config.Save()

	// Tell the world
	broadcastProjectUpdate(newProject)
}

// handleProjectUpdate takes in a project and a potential update and attempts
// to map the update to it. This function will write back a response if successful
func handleProjectUpdate(resp *ErrorReport, update *ProjectConfiguration) bool {
	for _, project := range Config.Projects {
		if project.ID == update.ID {
			err := project.Update(update)

			if err != nil {
				if err == ErrorCannotMatchService {
					resp.Level = ErrorLevelWarn
					resp.Message = err.Error()
					resp.Type = ErrorTypeUpdateWarning
				} else {
					resp.Level = ErrorLevelError
					resp.Message = err.Error()
					resp.Type = ErrorTypeUpdateFailure
				}
			} else {
				Debug.Println("Updated project:", project)
				Config.Save()

				// Tell the world
				broadcastProjectUpdate(project)
			}

			// Had a match, even if it errored out, we handled it here
			return true
		}
	}

	// No match
	return false
}

// gracefulShutdown registers signal handlers to ensure shutdowns are graceful.
// SIGTERM (signal 15) - gracefully shuts everything down
// SIGQUIT (signal 3) - will perform a stack dump to the logs
func gracefulShutdown(cancel func(), wg *sync.WaitGroup) {
	log.Println("Starting up graceful shutdown listener")

	//Listen for SIGTERM for shutdown signal
	signalChannel := make(chan os.Signal, 1)
	signal.Notify(signalChannel, os.Interrupt, syscall.SIGTERM, syscall.SIGQUIT)

	go func() {
	cancellationLoop:
		for {
			signal := <-signalChannel
			switch signal {
			case os.Interrupt, syscall.SIGTERM:
				log.Println(fmt.Sprintf("Got signal %v, initiating shutdown", signal))

				cancel()
				defer wg.Done()
				break cancellationLoop
			case syscall.SIGQUIT:
				// Reserve 1MB for the stack buffer
				buf := make([]byte, 1<<20)
				runstack := runtime.Stack(buf, true)

				// Dump it all out
				log.Println(fmt.Sprintf("Got signal %v\n*** goroutine dump...\n%s\n*** end\n", signal, buf[:runstack]))
				defer wg.Done()
				break cancellationLoop
			default:
				log.Println(fmt.Sprintf("Unknown signal %v", signal))
			}
		}
	}()
}

// waitForHalt starts a wait group and then
// waits until we receive a cancel/kill signal
func waitForHalt() {
	log.Println("Blocking until cancellation is received")

	wg := &sync.WaitGroup{}
	wg.Add(1)
	_, cancel := context.WithCancel(context.Background())
	gracefulShutdown(cancel, wg)

	wg.Wait()
}
