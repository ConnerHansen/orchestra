#!/bin/bash

checkArg () {
  if [[ "$1" != "" ]]; then
    error "Previous argument was not satisfied, exiting"
    printHelp

    exit 1
  fi
}

debug () {
  echo -e "\033[36m$1\033[0m"
}

error () {
  echo -e "\033[31m$1\033[0m"
}

info () {
  echo -e "\033[39m$1\033[0m"
}

printHelp () {
  info "build.sh is the build script for Orchestra"
  info ""
  info "Usage"
  info "\t./build.sh [args]"
  info ""
  info "Arguments"
  info "\t-a --arch\t specifies the target architecture. Supported options are: 386|amd64"
  info "\t-b --background\t executes orchestra after a successful build and runs it in the background"
  info "\t-h --help\t prints this help menu and exits"
  info "\t-o --open\t open a browser window to the orchestra page after launch"
  info "\t-r --run\t executes orchestra after a successful build"
  info "\t-t --target\t specifies the target operating system. Supported options are: darwin|linux|windows"
  info ""
}

opt=""
setOpt=""

# Get the default GOOS and GOARCH values in case they
# aren't overridden later (this lets us log them correctly)
export GOOS=$(go env GOOS)
export GOARCH=$(go env GOARCH)

# Figure out what args were passed in
for arg in $@
do
  if [[ "$arg" == "-h" || "$arg" == "--help" ]]
  then
    printHelp
    exit 0
  elif [[ "$arg" == "-r" || "$arg" == "--run" ]]
  then
    RUN="run"
  elif [[ "$arg" == "-b" || "$arg" == "--background" ]]
  then
    BACKGROUND="background"
  elif [[ "$arg" == "-o" || "$arg" == "--open" ]]
  then
    OPEN="--open"
  elif [[ "$arg" == "-a" || "$arg" == "--arch" ]]
  then
    checkArg "$opt"
    opt="ARCH"
  elif [[ "$arg" == "-t" || "$arg" == "--target" ]]
  then
    checkArg "$opt"
    opt="TARGET"
  elif [[ "$opt" == "ARCH" ]]
  then
    if [[ "$arg" == "386" || "$arg" == "amd64" ]]
    then
      debug "Setting architecture to $arg"
      export GOARCH="$arg"
      opt=""
    else
      error "Unsupported architecture $arg"
      printHelp

      exit 1
    fi
  elif [[ "$opt" == "TARGET" ]]
  then
    if [[ "$arg" == "windows" || "$arg" == "darwin" || "$arg" == "linux" ]]
    then
      debug "Setting build target to $arg"
      export GOOS="$arg"
      opt=""
    else
      error "Unsupported operating system $arg"
      printHelp

      exit 1
    fi
  else
    error "Unknown option $arg"
    printHelp

    exit 1
  fi
done

# Make sure we don't have a trailing arg
checkArg "$opt"

# processArgs

if [ ! -f ssl/server.crt ]
then
  debug "No SSL certs were discovered, autogenerating local dev certs..."
  ./dev_keygen.sh
fi

BUILD_VERSION=$(git rev-parse HEAD | awk '{print substr($0,0,10)}')
debug "Setting build version to $BUILD_VERSION"

# Load the override -- our build version is our current commit hash. This grants
# the actual build version real world meaning
verVar="-X main.OrchestraBuildVersion=$BUILD_VERSION"

debug "Building binary for $GOOS($GOARCH)"
# Generate the assets, and -- if successful -- build orchestra
go generate && go build -ldflags "$verVar"

if [ $? -ne 0 ]; then
  error "Build failed to execute correctly, exiting"
  exit 1
fi
debug "Build finished"

if [[ "$RUN" != "" ]]
then
  if [[ "$BACKGROUND" != "" ]]
  then
    debug "Starting orchestra in the background"
    ORCH_ENV=DEV ./orchestra "$OPEN" > logs/orchestra.log &
  else
    debug "Starting orchestra in the current terminal"
    ORCH_ENV=DEV ./orchestra "$OPEN" | tee logs/orchestra.log
  fi
else
  if [[ "$BACKGROUND" != "" ]]
  then
    debug "Starting orchestra in the background"
    ORCH_ENV=DEV ./orchestra "$OPEN" > logs/orchestra.log &
  fi
fi
