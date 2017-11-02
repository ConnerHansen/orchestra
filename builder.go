package main

import (
	"io/ioutil"
	"log"
	"strings"
)

var (
	mockeryCache *[]byte

	// MockeryFiles is the array of files that gets stitched into
	// the app/mockery.js file
	MockeryFiles = []string{
		"assets/app/mockery/mockery_core.js",
	}

	orchestraCache *[]byte

	// OrchestraFiles is the array of files that gets stitched into
	// the app/orchestra.js file. Also this is order dependent, so
	// plz keep that in mind before alphabetizing them
	OrchestraFiles = []string{
		"assets/app/orchestra/orchestra_core.js",
		"assets/app/orchestra/project_manager.js",
		"assets/app/orchestra/view_utilities.js",
		"assets/app/orchestra/socket_utilities.js",
		"assets/app/orchestra/modal.js",
		"assets/app/orchestra/modal_fields.js",
	}
)

func buildUnifiedFile(extension, dir string, srcFiles []string, cache *[]byte) []byte {
	data := []byte{}

	// Make sure the dir has a trailing slash
	if !strings.HasSuffix(dir, "/") {
		dir = dir + "/"
	}

	// If we're in production, we need to use the Asset call since
	// we won't have the actual assets dir with us
	if Environment == EnvironmentProd {
		// Cache is empty, build it, then store it for future reference
		if len(*cache) == 0 {
			for _, entry := range srcFiles {
				if strings.HasSuffix(entry, extension) {
					contents, err := Asset(entry)
					if err != nil {
						Error.Println("Error while building resource:", err)
					} else {
						data = append(data, contents...)
					}
				}
			}

			cache = &data
		}

		// Now make sure we put whatever is in the cache back
		// into the data object
		data = *cache
	} else {
		// Dev mode. For now, we're just going to be dumb and recompile
		// every time.
		for _, entry := range srcFiles {
			if strings.HasSuffix(entry, extension) {
				contents, err := ioutil.ReadFile(entry)
				if err != nil {
					Error.Println("Error while building:", entry, err)
				} else {
					Info.Println("Building asset:", entry)
					data = append(data, contents...)
				}
			}
		}

		// If there are files that weren't mentioned explicitly in the dir, Load
		// them in anyways
		files, err := ioutil.ReadDir(dir)
		if err != nil {
			log.Fatal(err)
		}
		for _, file := range files {
			if strings.HasSuffix(file.Name(), extension) {
				path := dir + file.Name()
				alreadyLoaded := false

				// Was this a known file that we need to load in a specific order?
				for _, entry := range srcFiles {
					if entry == path {
						alreadyLoaded = true
					}
				}

				// Nope! Load it
				if !alreadyLoaded {
					Info.Println("Building asset:", path)
					contents, err := ioutil.ReadFile(path)
					if err != nil {
						Error.Println("Error while building file:", file, err)
					} else {
						data = append(data, contents...)
					}
				}
			}
		}
	}

	return data
}

func buildMockery() []byte {
	return buildUnifiedFile(".js", "assets/app/mockery", MockeryFiles, mockeryCache)
}

func buildOrchestra() []byte {
	return buildUnifiedFile(".js", "assets/app/orchestra", OrchestraFiles, orchestraCache)
}
