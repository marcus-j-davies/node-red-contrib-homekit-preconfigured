module.exports = function (RED)
{
    function Init(config)
    {
        const node = this;
        RED.nodes.createNode(this, config);

        if (config.originalId == undefined || this.id != config.originalId) {
            node.status({ fill: "red", shape: "dot", text: "Please Review Configuration" });
            node.error("Please review the Configuration, to ensure this node's values (username,pin & port) are unique across your homekit devices. If you simply open and save the configuration without making any necessary changes. you risk bigger problems.");
            return;
        }


        node.status({ fill: "red", shape: "dot", text: "Starting..." });

        const HapNodeJS = require("hap-nodejs");
        const Service = HapNodeJS.Service;
        const Accessory = HapNodeJS.Accessory;
        const Characteristic = HapNodeJS.Characteristic;
        const uuid = HapNodeJS.uuid;
        const CharacteristicEventTypes = HapNodeJS.CharacteristicEventTypes;
        const AccessoryEventTypes = HapNodeJS.AccessoryEventTypes;

        const UUID = uuid.generate('hap-nodejs:accessories:tv:' + config.name);

        if (RED.settings.available())
        {
            const userDir = RED.settings.userDir;
            HapNodeJS.init(userDir + "/homekit-persist");
        }
        else
        {
            HapNodeJS.init();
        }


        const Properties = {};
        
        
        // Accessory
        const accessory = exports.accessory = new Accessory(config.name, UUID);
        accessory.username = config.username;
        accessory.pincode = config.pincode;
        accessory.category = Accessory.Categories.TELEVISION;

        // Identify Event
        function Identify()
        {
            const message =
            {
                "payload":
                    {
                        "event": "AccessoryIdentify"
                    }
            }
            node.send(message);
        }
        accessory.on(AccessoryEventTypes.IDENTIFY, function (paired, callback)
        {
            callback();
            Identify();
            
        });

        // Main Service
        const service = accessory.addService(Service.Television, config.name, config.name);
        service.setCharacteristic(Characteristic.ConfiguredName, config.name);
        service.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
        service.setCharacteristic(Characteristic.Active, 0);
        service.setCharacteristic(Characteristic.ActiveIdentifier, 1);
        Properties["Active"] = 0;
        Properties["ActiveIdentifier"] = 1;


        function Set(event,property, value, callback, hap)
        {
            if (hap == null)
            {
                callback(null);
                return;
            }

            const message =
             {
                 "payload":
                     {
                         "event": event,
                         "characteristic": property,
                         "value": value
                     }
             }

            // Set speaker also (we're not a radio, we're a TV)
            if (property == "Active")
            {
                Speaker.setCharacteristic(Characteristic[property], value)
            }

            Properties[property] = value;
            node.send(message);
            callback(null);
        }

      

        const GetCallbacks = {}
        function Get(property, callback)
        {
            if (config.interceptget == "Yes")
            {
                GetCallbacks[property] = callback;
                const message =
               {
                   "payload":
                       {
                           "event": "GetCharacteristic",
                           "characteristic": property
                       }
               }
                node.send(message);
            }
            else
            {
                if (Properties[property] != null)
                {
                    callback(null, Properties[property]);
                }
                else
                {
                    callback(null, null);
                }
            }


          
        }

        // Remote Key
        service.getCharacteristic(Characteristic.RemoteKey)
            .on(CharacteristicEventTypes.SET, function (value, callback,hap) { Set("ControlAction", "RemoteKey", value, callback,hap) });

        // Active
        service.getCharacteristic(Characteristic.Active)
            .on(CharacteristicEventTypes.SET, function (value, callback,hap) { Set("CharacteristicChange", "Active", value, callback,hap) })
            .on(CharacteristicEventTypes.GET, function (callback) { Get("Active", callback) });

        // Input
        service.getCharacteristic(Characteristic.ActiveIdentifier)
            .on(CharacteristicEventTypes.SET, function (value, callback,hap) { Set("CharacteristicChange", "ActiveIdentifier", value, callback,hap) })
            .on(CharacteristicEventTypes.GET, function (callback) { Get("ActiveIdentifier", callback) });
       
        // Power Mode Selection
        service.getCharacteristic(Characteristic.PowerModeSelection)
            .on(CharacteristicEventTypes.SET, function (value, callback,hap) { Set("ControlAction", "PowerModeSelection", value, callback,hap) });
        

        /*
        // Picture Mode (not configured)
        service.getCharacteristic(Characteristic.PictureMode).on(CharacteristicEventTypes.SET, function (value, callback)
        {

            callback(null);
        });
        */


        

        // Speaker Service
        const Speaker = accessory.addService(Service.TelevisionSpeaker);
        Speaker.setCharacteristic(Characteristic.Active, 0)
        Speaker.setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);

        // Volume Status
        Speaker.getCharacteristic(Characteristic.Active)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("Active", callback) });

        // Volume Level
        Speaker.getCharacteristic(Characteristic.VolumeSelector)
            .on(CharacteristicEventTypes.SET, function (value, callback,hap) { Set("ControlAction", "VolumeSelector", value, callback,hap) });


        

      

       
       


        // Configure Inputs
        const Inputs = [];
        const A_Inputs = config.input_names.split(",");
        for (let i = 0; i < A_Inputs.length; i++)
        {
            const Input = accessory.addService(Service.InputSource, A_Inputs[i], A_Inputs[i]);
            Input.setCharacteristic(Characteristic.Identifier, (i + 1))
            Input.setCharacteristic(Characteristic.ConfiguredName, A_Inputs[i])
            Input.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
            Input.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.HDMI)
            Input.setCharacteristic(Characteristic.CurrentVisibilityState, 0);
            Input.setCharacteristic(Characteristic.TargetVisibilityState, 0);
            service.addLinkedService(Input);

            Inputs.push(Input);
        }

        node.on('close', function (removed, done) {
            if (removed) {
                accessory.destroy();
            }
            else {
                accessory.unpublish()
            }

            done();


        });

        node.on('input', function (msg)
        {
            if (msg.payload == "GetCharacteristics")
            {
                node.send({"payload":Properties});
                return;
            }

            const Props = Object.keys(msg.payload);

            for (let i = 0; i < Props.length; i++)
            {
                if (GetCallbacks[Props[i]] != null)
                {
                    GetCallbacks[Props[i]](null, msg.payload[Props[i]]);
                    delete GetCallbacks[Props[i]];
                }

                service.setCharacteristic(Characteristic[Props[i]], msg.payload[Props[i]])

                if (Props[i] == "Active")
                {
                    Speaker.setCharacteristic(Characteristic[Props[i]], msg.payload[Props[i]])
                }
                
                Properties[Props[i]] = msg.payload[Props[i]];
            }
        });

        accessory.publish({ port: config.port, username: accessory.username, pincode: accessory.pincode,category: accessory.category });

        setTimeout(function ()
        {
            const startmsg =
                {
                    "payload":
                        {
                            "event": "AccessoryInitialised"
                        }
                }

            node.status({ fill: "green", shape: "dot", text: "Pincode :"+config.pincode });
            node.send(startmsg);

        }, 1000)

    }
    RED.nodes.registerType("hk-television", Init);
}
