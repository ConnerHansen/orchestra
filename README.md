# Orchestra

This is a utility for running/managing service ecosystems in a development
environment. Orchestra provides easy, direct access to any running service's
logs, the ability to cycle individual services easily, as well as the ability
to spawn mock services as needed.

## Requirements

After cloning the project, you will need to use Godep to restore the
dependencies. If you don't have Godep installed currently, run:
```sh
go get github.com/tools/godep
```
Then run:
```sh
godep restore
```

At this point, Orchestra should now be buildable.

## Building

Orchestra provides a small build script for managing builds. To simply generate
the binary, just run the script:
```sh
./build.sh
```

There are various other commands provided by the build utility. These are
described in the help output:
```
build.sh is the build script for Orchestra

Usage
	./build.sh [args]

Arguments
	-b --background	 executes orchestra after a successful build and runs it in the background
	-h --help	 prints this help menu and exits
	-o --open	 open a browser window to the orchestra page after launch
	-r --run	 executes orchestra after a successful build
```

## Running
Orchestra can be executed without an existing configuration by simply running
`./orchestra` to start the server after running a build. Or orchestra can be
started along with the build by running `./build.sh -r`

By default, Orchestra will bind to port 8080, and is only accessible on the
local machine. If you want to open Orchestra up to your network, you will need
to open up the configuration at `~/.orchestra/config.json` and change the two
`AcceptAddr*` entries to be empty strings (or your hostname, etc).

## License

```
Copyright © 2017 Spiceworks, Inc.

This work is free. You can redistribute it and/or modify it under the
terms of the MIT License. See the LICENSE file for more details.
```
