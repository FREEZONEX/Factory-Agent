module.exports = function(RED) {
    function FactoryAgentStatesNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        
        // Node configuration
        this.systemPrompt = config.systemPrompt || "";
        this.environmentDescription = config.environmentDescription || "";
        this.initialDelay = parseInt(config.initialDelay) || 30; // Default to 30 seconds if not specified
        
        // Initialize cache and state flags
        var topicCache = {};
        var firstMessageSent = false;  // Flag to track if the first message has been sent
        var initialTimerId = null;     // Reference to the initial timer
        
        let connectedAgentNode = null;

        // Function to send a state message
        function sendStateMsg() {
            // Only proceed if we have some data in the cache
            if (Object.keys(topicCache).length > 0) {
                const currentCache = Object.assign({}, topicCache);
                topicCache = {}; // Clear the cache after sending
                var stateMsg = {
                    sysPrompt: node.systemPrompt,
                    envPrompt: node.environmentDescription,
                    state: currentCache
                };
                // Send message
                node.send(stateMsg);
            }
        }
        
        // Set up flow context watcher - only starts checking after first message sent
        var flowContext = this.context().flow;
        var checkInterval = setInterval(function() {
            // Only check flow context if first message has already been sent
            if (firstMessageSent && connectedAgentNode) {
                const nodeStateKey = 'agentstate.' + connectedAgentNode.id;
                var agentState = flowContext.get(nodeStateKey);
                // if (agentState === "received") 
                if (agentState === "received" && Object.keys(topicCache).length > 0){
                    // Send state message
                    sendStateMsg();
                    node.status({fill:"green", shape:"dot", text:"Sent state"});
                    
                    // Reset the flow variable to avoid repeated triggers
                    flowContext.set(nodeStateKey, "processing");
                }
            }
        }, 1000); // Check every second
        
        // Clean up when node is removed
        this.on('close', function() {
            clearInterval(checkInterval);
            if (initialTimerId) {
                clearTimeout(initialTimerId);
                initialTimerId = null;
            }
            topicCache = {};
        });
        
        // Listen for input messages
        this.on('input', function(msg) {
            // Process regular messages with payloads
            if (msg.hasOwnProperty('payload')) {
                // Cache the message payload based on its topic
                var topic = msg.topic || "default";
                topicCache[topic] = msg.payload;
                
                // Update status to show caching is happening
                node.status({fill:"blue", shape:"ring", text:"Cached: " + topic});
                
                // Only set up the initial timer if we haven't sent the first message yet
                // and we don't already have a timer running
                if (!firstMessageSent && !initialTimerId) {

                    if (config.wires && config.wires.length > 0 && config.wires[0].length > 0) {
                        const firstConnectedNodeId = config.wires[0][0];
                        const nextNode = RED.nodes.getNode(firstConnectedNodeId);
            
                        if (nextNode &&
                            (nextNode.type === 'factory-agent-deepseek' ||
                             nextNode.type === 'factory-agent-gemini')) {
                            connectedAgentNode = nextNode;
                            node.debug("Connected agent node ID: " + connectedAgentNode.id);
                        } else if (nextNode) {
                            node.debug("Connected node is not a target agent type: " + nextNode.type + " (ID: " + nextNode.id + ")");
                        } else {
                            node.debug("Could not find connected node with ID: " + firstConnectedNodeId);
                        }
                    } else {
                        node.debug("No nodes connected to the first output of this node.");
                    }

                    node.status({fill:"yellow", shape:"dot", text:"Initial timer: " + node.initialDelay + "s"});
                    
                    // Set up the initial delay timer
                    initialTimerId = setTimeout(function() {
                        // Send out the first message
                        sendStateMsg();
                        node.status({fill:"green", shape:"dot", text:"Sent initial state"});
                        
                        // Mark first message as sent and clear timer reference
                        firstMessageSent = true;
                        initialTimerId = null;
                    }, node.initialDelay * 1000);
                }
            }
        });
    }
    
    RED.nodes.registerType("factory-agent-states", FactoryAgentStatesNode);
}