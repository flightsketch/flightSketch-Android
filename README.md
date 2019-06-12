# FlightSketch Android Mobile Application 
This application is built using the [Ionic Framework](https://ionicframework.com/) 

## Pre-reqs
* The Ionic CLI and its dependencies - https://ionicframework.com/getting-started#cli
* The Android platform dependencies (use Java 1.8) - https://cordova.apache.org/docs/en/8.x/guide/platforms/android/

## Configuring the working directory after cloning the repo
1. $ npm -install
2. $ ionic cordova platform add android

## Running the app on an Android phone
1. Ensure your phone has USB debugging enabled
2. Attach your phone to your workstation with a USB cable
3. $ ionic cordova run android

## Finding the binary APK for Android
* Ionic stores the APK in /platforms/android/app/build/outputs/apk/debug/

