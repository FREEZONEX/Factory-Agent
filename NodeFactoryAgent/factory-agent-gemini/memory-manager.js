class MemoryManager {
    constructor(node, maxMemoryLength = 1) {
        this.node = node;
        this.maxMemoryLength = maxMemoryLength;
        this.memoryKey = 'memory.' + node.id;
    }

    getMemory() {
        return this.node.context().get(this.memoryKey) || [];
    }

    addMemory(entry) {
        try {
            const formattedEntry = {
                timestamp: new Date().toISOString(),
                state: typeof entry.state === 'string' ? entry.state : JSON.stringify(entry.state),
                response: entry.response
            };

            let memory = this.getMemory();
            memory.push(formattedEntry);
            
            if (memory.length > this.maxMemoryLength) {
                memory = memory.slice(-this.maxMemoryLength);
            }
            
            this.node.context().set(this.memoryKey, memory);
            return memory;
        } catch (error) {
            this.node.error("Error adding memory: " + error.message);
            return this.getMemory();
        }
    }

    clearMemory() {
        this.node.context().set(this.memoryKey, []);
    }

    // Format memory to text
    formatMemoryToText() {
        const memory = this.getMemory();
        if (!memory.length) return "";
        
        return "Previous Interactions:\n" + memory.map((entry, index) => {
            return `[${index + 1}] ${entry.timestamp}\n` +
                   `Input:\n${entry.state}\n` +
                   `Response: ${entry.response}\n`;
        }).join("\n---\n");
    }
}

module.exports = MemoryManager;