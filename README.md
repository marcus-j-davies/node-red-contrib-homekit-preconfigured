# node-red-contrib-homekit-preconfigured
A collection of node-red nodes, representing various preconfigured Homekit devices, supporting their full functionality.

Current configured nodes:
  - Switch
  - Outlet
  - Television (Volume, Input, Power and menu navigation)
  - Intruder Alarm
  - Motion Sensor
  - Contact Sensor (Window/Door)
  - IP Cameras (Requires FFMPEG with libx264 or h264_omx for hardware acceleration on a pi)
  - Thermostat
  - Smart Lock
  - Garage Door Opener

All nodes have their various events configured. i.e. The Television node emits power state, input source, key command and volume changes.
the Accessory based events are also sent i.e. the Accessory being initialised & identified.

    "payload":{
      "event":"CharacteristicChange",
      "characteristic":"ActiveIdentifier",
      "value":3
    }

As well as outputs (above), the nodes takes an input. The input should contain a **payload** object with various key:value paires, describing the various Characteristics to set. This will affect the status of the icons in the Homeapp accordingly.

    "payload":{
      "On":1,
      "OutletInUse":1
    }

The aim is to build up a rich set of Accessories (IP Cameras also), and make them ready made nodes for node-red.

## Why?
You might ask, why use this instead of [node-red-contrib-homekit-bridged](https://github.com/NRCHKB/node-red-contrib-homekit-bridged) and my answer to that will be use node-red-contrib-homekit-bridged, espcially if you are knowledgeable in Apples Homekit Accessory Protocol. It offers the ability to create most Homekit Accessories, its an awsome module for node-red and works very very well. For me however, I wanted the following:
  - To have full visibility of the events emitted from the accessory
  - To have all the required and optional Characteristics configured for each accessory type (TV Accessory being one of them)
  - To have each Accessory type work 'out of the box' i.e you want an Alarm Accessory, then drag the Alarm node in to your flow
  
And so i created this repo.

## Installing
Homekit depends on Bonjour, so you will need to install a library to help with that (windows users can skip this step)

    sudo apt-get install libavahi-compat-libdnssd-dev
    
Use the Node Red Palette menu or alternatively...

Within the .node-red directory, clone this repository

    git clone https://github.com/marcus-j-davies/node-red-contrib-homekit-preconfigured.git

Then install with npm

    npm install ./node-red-contrib-homekit-preconfigured
    
After this, restart node-red. and the nodes will be ready to use.

![Nodes](https://github.com/marcus-j-davies/node-red-contrib-homekit-preconfigured/blob/master/Nodes.PNG?raw=true)

## Configuration
Bring in a node of your choice, and double click to configure the Accessory accordingly.

![Confgure](https://github.com/marcus-j-davies/node-red-contrib-homekit-preconfigured/blob/master/Configure.PNG?raw=true)

## Obtaining current Characteristics
You can query the current values for the various Characteristics.
You do this by sending a **payload** object containing the string **GetCharacteristics**
  
    {"payload":"GetCharacteristics"}

In return you will get a **payload** object with the various key:value paires representing the  Characteristics for the device.
This also helps in determining what Characteristics can be set.

## Responding to Homekit status queries
Saying something like '**Hey Siri, is my tea mug warmer turned on**', siri will query homekit for the corrosponding Characteristic.
The nodes allow you to intercept this query, so you can fetch the status of your physical device as necessary, then finally returning the expected value back to Homwekit/Siri.

When  a query has taken place, the follwoing event is emited.
the query is for the '**On**' status of a switch.


    "payload":{
      "event":"GetCharacteristic",
      "characteristic":"On"
    }

To respond, simply send a normal Characteristic change.
Note: In order to intercept these commands, you will need to set the config value 'Intercept Get Commands' to Yes

    "payload":{
      "On":0
    }

## Credits
A Special thanks to KhaosT (https://github.com/KhaosT) and the awsome contributors for the amazing hap-nodejs project, that makes projects like this one possible.

## Version History
  - 1.2.0  
    Added Garage Door Opener ([#2](https://github.com/marcus-j-davies/node-red-contrib-homekit-preconfigured/issues/2))
  - 1.1.0  
    Cleaned up config UI (Values for new accessories are generated on open)
    Bump HAP-NodeJS to 0.5.6
    Added Lock Accessory node.
  - 1.0.0  
    Initial Release