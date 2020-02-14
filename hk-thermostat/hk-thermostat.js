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

        const UUID = uuid.generate('hap-nodejs:accessories:thermostat:' + config.name);

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
        accessory.category = Accessory.Categories.THERMOSTAT;

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
        const service = accessory.addService(Service.Thermostat, config.name, config.name);

        service.setCharacteristic(Characteristic.CurrentHeatingCoolingState, 0);
        service.setCharacteristic(Characteristic.TargetHeatingCoolingState, 0);
        service.setCharacteristic(Characteristic.CurrentTemperature, 21);
        service.setCharacteristic(Characteristic.TargetTemperature, 21);
        service.setCharacteristic(Characteristic.TemperatureDisplayUnits, 0);
        Properties["CurrentHeatingCoolingState"] = 0;
        Properties["TargetHeatingCoolingState"] = 0;
        Properties["CurrentTemperature"] = 21;
        Properties["TargetTemperature"] = 21;
        Properties["TemperatureDisplayUnits"] = 0;

        if (config.supportsCooling == "Yes")
        {
            service.setCharacteristic(Characteristic.CoolingThresholdTemperature, 26);
            service.setCharacteristic(Characteristic.HeatingThresholdTemperature, 18);
            Properties["CoolingThresholdTemperature"] = 26;
            Properties["HeatingThresholdTemperature"] = 18;
           
        }

      

        function Set(property,value,callback,hap)
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
                         "event": "CharacteristicChange",
                         "characteristic": property,
                         "value": value
                     }
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


       


        // Target State
        service.getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .on(CharacteristicEventTypes.SET, function (value, callback, hap) { Set("TargetHeatingCoolingState", value, callback, hap) })
            .on(CharacteristicEventTypes.GET, function (callback) { Get("TargetHeatingCoolingState", callback) });

        // Current State
        service.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("CurrentHeatingCoolingState", callback) });

        // Display
        service.getCharacteristic(Characteristic.TemperatureDisplayUnits)
            .on(CharacteristicEventTypes.SET, function (value, callback, hap) { Set("TemperatureDisplayUnits", value, callback, hap) })
            .on(CharacteristicEventTypes.GET, function (callback) { Get("TemperatureDisplayUnits", callback) });

        // Current Temp
        service.getCharacteristic(Characteristic.CurrentTemperature)
           .on(CharacteristicEventTypes.GET, function (callback) { Get("CurrentTemperature", callback) });

        // Taregt Temp
        service.getCharacteristic(Characteristic.TargetTemperature)
            .on(CharacteristicEventTypes.SET, function (value, callback, hap) { Set("TargetTemperature", value, callback, hap) })
            .on(CharacteristicEventTypes.GET, function (callback) { Get("TargetTemperature", callback) });

        // Cooling modes
        if (config.supportsCooling == "Yes")
        {
            service.getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .on(CharacteristicEventTypes.SET, function (value, callback, hap) { Set("CoolingThresholdTemperature", value, callback, hap) })
            .on(CharacteristicEventTypes.GET, function (callback) { Get("CoolingThresholdTemperature", callback) });

            service.getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .on(CharacteristicEventTypes.SET, function (value, callback, hap) { Set("HeatingThresholdTemperature", value, callback, hap) })
            .on(CharacteristicEventTypes.GET, function (callback) { Get("HeatingThresholdTemperature", callback) });


          

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

            node.status({ fill: "green", shape: "dot", text: "Pincode :" + config.pincode });
            node.send(startmsg);

        }, 1000)
    }

    RED.nodes.registerType("hk-thermostat", Init);

}

    
