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
        const Camera = require('./Camera.js').Camera
       

        const UUID = uuid.generate('hap-nodejs:accessories:camera:' + config.name);

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
        accessory.category = Accessory.Categories.CAMERA;
        
        const CS = new Camera(config);
        accessory.configureCameraSource(CS);

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

    RED.nodes.registerType("hk-camera", Init);

}
