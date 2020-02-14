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

        const UUID = uuid.generate('hap-nodejs:accessories:contactsensor:' + config.name);

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
        accessory.category = Accessory.Categories.SENSOR;

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
        const service = accessory.addService(Service.ContactSensor, config.name, config.name);
        service.setCharacteristic(Characteristic.ContactSensorState, 0);
        service.setCharacteristic(Characteristic.StatusFault, 0);
        service.setCharacteristic(Characteristic.StatusTampered, 0);
        service.setCharacteristic(Characteristic.StatusActive, 1);
        Properties["StatusFault"] = 0;
        Properties["StatusTampered"] = 0;
        Properties["ContactSensorState"] = 0;
        Properties["StatusActive"] = 1;

        // Battery service
        const BatteryService = accessory.addService(Service.BatteryService, config.name, config.name);
        BatteryService.setCharacteristic(Characteristic.BatteryLevel, 100);
        BatteryService.setCharacteristic(Characteristic.StatusLowBattery, 0);
        BatteryService.setCharacteristic(Characteristic.ChargingState, 0);
        Properties["BatteryLevel"] = 100;
        Properties["StatusLowBattery"] = 0;
        Properties["ChargingState"] = 0;

        service.addLinkedService(BatteryService);

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


       


        // State
        service.getCharacteristic(Characteristic.ContactSensorState)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("ContactSensorState", callback) });
        
         // Fault
        service.getCharacteristic(Characteristic.StatusFault)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("StatusFault", callback) });

        // Tampered
        service.getCharacteristic(Characteristic.StatusTampered)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("StatusTampered", callback) });
        
        // Active
        service.getCharacteristic(Characteristic.StatusActive)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("StatusActive", callback) });

        // Battery
        BatteryService.getCharacteristic(Characteristic.BatteryLevel)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("BatteryLevel", callback) });
        BatteryService.getCharacteristic(Characteristic.StatusLowBattery)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("StatusLowBattery", callback) });
        BatteryService.getCharacteristic(Characteristic.ChargingState)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("ChargingState", callback) });
       

       

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

            const BatteryTargets = ["BatteryLevel", "StatusLowBattery", "ChargingState"]

            for (let i = 0; i < Props.length; i++)
            {
                if (GetCallbacks[Props[i]] != null)
                {
                    GetCallbacks[Props[i]](null, msg.payload[Props[i]]);
                    delete GetCallbacks[Props[i]];
                }

                if (BatteryTargets.includes(Props[i]))
                {
                    BatteryService.setCharacteristic(Characteristic[Props[i]], msg.payload[Props[i]])
                    Properties[Props[i]] = msg.payload[Props[i]];
                }
                else
                {
                    service.setCharacteristic(Characteristic[Props[i]], msg.payload[Props[i]])
                    Properties[Props[i]] = msg.payload[Props[i]];
                }

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

    RED.nodes.registerType("hk-contact", Init);

}

    
