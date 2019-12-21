module.exports = function (RED)
{
    function Init(config)
    {
        const node = this;
        RED.nodes.createNode(this, config);
        node.status({ fill: "red", shape: "dot", text: "Starting..." });

        const HapNodeJS = require("hap-nodejs");
        const Service = HapNodeJS.Service;
        const Accessory = HapNodeJS.Accessory;
        const Characteristic = HapNodeJS.Characteristic;
        const uuid = HapNodeJS.uuid;
        const CharacteristicEventTypes = HapNodeJS.CharacteristicEventTypes;
        const AccessoryEventTypes = HapNodeJS.AccessoryEventTypes;

        const UUID = uuid.generate('hap-nodejs:accessories:alarm:' + config.name);

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
        accessory.category = Accessory.Categories.SECURITY_SYSTEM;

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
        const service = accessory.addService(Service.SecuritySystem, config.name, config.name);
        service.setCharacteristic(Characteristic.StatusFault, 0);
        service.setCharacteristic(Characteristic.StatusTampered, 0);
        service.setCharacteristic(Characteristic.SecuritySystemCurrentState, 3);
        service.setCharacteristic(Characteristic.SecuritySystemTargetState, 3);
        Properties["SecuritySystemTargetState"] = 3;
        Properties["SecuritySystemCurrentState"] = 3;
        Properties["StatusFault"] = 0;
        Properties["StatusTampered"] = 0;


        function Set(property, value, callback,hap)
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

        // Target
        service.getCharacteristic(Characteristic.SecuritySystemTargetState)
            .on(CharacteristicEventTypes.SET, function (value, callback,hap) { Set("SecuritySystemTargetState", value, callback,hap) })
            .on(CharacteristicEventTypes.GET, function (callback) { Get("SecuritySystemTargetState", callback) });

        // Current
        service.getCharacteristic(Characteristic.SecuritySystemCurrentState)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("SecuritySystemCurrentState", callback) });

        // Fault
        service.getCharacteristic(Characteristic.StatusFault)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("StatusFault", callback) });

        // Tampered
        service.getCharacteristic(Characteristic.StatusTampered)
            .on(CharacteristicEventTypes.GET, function (callback) { Get("StatusTampered", callback) });
      

     

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

            node.status({ fill: "green", shape: "dot", text: "Pincode :"+config.pincode });
            node.send(startmsg);

        }, 1000)

    }
    RED.nodes.registerType("hk-alarm", Init);
}
