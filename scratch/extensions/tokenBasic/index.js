const formatMessage = require('format-message')

const ArgumentType = require('../../../extension-support/argument-type')
const BlockType = require('../../../extension-support/block-type')
const log = require('../../../util/log')

const regEx = require('../regEx')
const Contract = require('./TokenBasic')

class ContractBlocks {

    constructor(runtimeProxy) {
        this.runtime = runtimeProxy

        this.contract = new Contract()

        this.eventNames = ['Transfer', 'TransferFrom', 'Approve']
        this.eventQueues = {}

        for (let eventName of this.eventNames) {
            this.registerEvent(eventName)
        }

        this.contract.startWatchingEvents()
    }

    registerEvent(eventName)
    {
        log.debug(`Registering event ${eventName}`)

        // Register queue for emitted events
        this.eventQueues[eventName] = {
            queue: [],
            pendingDequeue: false
        }

        // Add event listener to add events to the queue
        this.contract.eventEmitter.on(eventName, (event) => {
            log.info(`Adding ${eventName} event to queue with hash ${event.transactionHash}. Queue length ${this.eventQueues[eventName].queue.length}`)
            this.eventQueues[eventName].queue.push(event)
        })
    }

    // is there a new event that can be dequeued?
    isQueuedEvent(args) {

        const eventName = args.EVENT_NAME

        if (!this.eventQueues || !this.eventQueues[eventName]) {
            log.error(`Failed to find "${eventName}" event queue.`)
            return false
        }

        const eventQueue = this.eventQueues[eventName]

        if (eventQueue.queue.length > 0 && eventQueue.pendingDequeue === false) {
            log.info(`When pending ${eventName} event with hash ${eventQueue.queue[0].transactionHash}`)
            eventQueue.pendingDequeue = true
            return true
        }
        else {
            return false
        }
    }

    // dequeue a pending event
    dequeueEvent(args)
    {
        const eventName = args.EVENT_NAME

        const description = `dequeue the "${eventName}" event`

        if (!this.eventQueues || !this.eventQueues[eventName]) {
            log.error(`Failed to ${description} as failed to find the "${eventName}" event queue.`)
            return
        }

        const eventQueue = this.eventQueues[eventName]

        if (!eventQueue.pendingDequeue) {
            log.error(`Failed to ${description} as no events are on the queue. Queue length ${eventQueue.queue.length}.`)
            return
        }

        log.info(`About to ${description} with hash ${eventQueue.queue[0].transactionHash}`)

        // remove the oldest event from the queue
        eventQueue.queue.shift()
        eventQueue.pendingDequeue = false

        log.debug(`${eventQueue.queue.length} in the "${eventName}" event queue after dequeue`)
    }

    getQueuedEventProperty(args)
    {
        const eventName = args.EVENT_NAME
        const propertyName = args.EVENT_PROPERTY.toLowerCase()

        const description = `read property "${propertyName}" from queued "${eventName}" event`

        if (!this.eventQueues || !this.eventQueues[eventName]) {
            log.error(`Failed to ${description}. The ${eventName} queue does not exist.`)
            return
        }

        const eventQueue = this.eventQueues[eventName]

        if (!eventQueue.pendingDequeue) {
            log.error(`Failed to ${description} as no events are on the queue. Queue length ${eventQueue.queue.length}.`)
            return
        }

        if (!eventQueue.queue[0].args.hasOwnProperty(propertyName)) {
            log.error(`Failed to ${description} as property does not exist on the queued event.`)
            return
        }

        log.debug(`Property ${propertyName} from queued ${eventName} event with hash ${eventQueue.queue[0].transactionHash} has value ${eventQueue.queue[0].args[propertyName]}`)

        return eventQueue.queue[0].args[propertyName]
    }

    getInfo() {

        return {
            // Required: the machine-readable name of this extension.
            // Will be used as the extension's namespace.
            id: 'tokenBasic',

            // Optional: the human-readable name of this extension as string.
            // This and any other string to be displayed in the Scratch UI may either be
            // a string or a call to `formatMessage` a plain string will not be
            // translated whereas a call to `formatMessage` will connect the string
            // to the translation map (see below). The `formatMessage` call is
            // similar to `formatMessage` from `react-intl` in form, but will actually
            // call some extension support code to do its magic. For example, we will
            // internally namespace the messages such that two extensions could have
            // messages with the same ID without colliding.
            // See also: https://github.com/yahoo/react-intl/wiki/API#formatmessage
            // name: 'Crypto Beasts',
            name: formatMessage({
                id: 'tokenBasic.categoryName',
                default: 'Basic ERC20 Token',
                description: 'extension name',
            }),

            // Optional: URI for a block icon, to display at the edge of each block for this
            // extension. Data URI OK.
            // TODO: what file types are OK? All web images? Just PNG?
            // blockIconURI: 'data:image/pngbase64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAFCAAAAACyOJm3AAAAFklEQVQYV2P4DwMMEMgAI/+DEUIMBgAEWB7i7uidhAAAAABJRU5ErkJggg==',

            // Optional: URI for an icon to be displayed in the blocks category menu.
            // If not present, the menu will display the block icon, if one is present.
            // Otherwise, the category menu shows its default filled circle.
            // Data URI OK.
            // TODO: what file types are OK? All web images? Just PNG?
            // menuIconURI: 'data:image/pngbase64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAFCAAAAACyOJm3AAAAFklEQVQYV2P4DwMMEMgAI/+DEUIMBgAEWB7i7uidhAAAAABJRU5ErkJggg==',

            // Optional: Link to documentation content for this extension.
            // If not present, offer no link.
            // docsURI: 'https://github.com/naddison36/loom-scratch-tcg',

            // Required: the list of blocks implemented by this extension,
            // in the order intended for display.
            blocks: [
                {
                    opcode: 'setContract',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'tokenBasic.setContract',
                        default: 'Set contract [ADDRESS] on network with id [NETWORK_ID]',
                        description: 'command text',
                    }),
                    arguments: {
                        ADDRESS: {
                            type: ArgumentType.STRING,
                            defaultValue: 'tokenAddress',
                        },
                        NETWORK_ID: {
                            type: ArgumentType.NUMBER,
                            defaultValue: this.contract.network,
                        },
                    },
                },
                {
                    opcode: 'deploy',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'tokenBasic.deploy',
                        default: 'Deploy contract with total supply [TOTAL_SUPPLY]',
                        description: 'command text',
                    }),
                    arguments: {
                        TOTAL_SUPPLY: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0,
                        },
                    },
                },
                {
                    opcode: 'isQueuedEvent',
                    text: formatMessage({
                        id: 'cryptoBeasts.isQueuedEvent',
                        default: 'When [EVENT_NAME] event queued',
                        description: 'command text',
                    }),
                    blockType: BlockType.HAT,
                    arguments: {
                        EVENT_NAME: {
                            type: ArgumentType.STRING,
                            menu: 'events',
                            defaultValue: 'Transfer'
                        }
                    }
                },
                {
                    opcode: 'dequeueEvent',
                    text: formatMessage({
                        id: 'cryptoBeasts.dequeueTransfer',
                        default: 'Dequeue [EVENT_NAME] event',
                        description: 'command text',
                    }),
                    blockType: BlockType.COMMAND,
                    arguments: {
                        EVENT_NAME: {
                            type: ArgumentType.STRING,
                            menu: 'events',
                            defaultValue: 'Transfer'
                        }
                    }
                },
                {
                    opcode: 'getQueuedEventProperty',
                    text: formatMessage({
                        id: 'cryptoBeasts.getQueuedEventProperty',
                        default: 'Property [EVENT_PROPERTY] of [EVENT_NAME] event',
                        description: 'command text',
                    }),
                    blockType: BlockType.REPORTER,
                    arguments: {
                        EVENT_NAME: {
                            type: ArgumentType.STRING,
                            menu: 'events',
                            defaultValue: 'Transfer'
                        },
                        EVENT_PROPERTY: {
                            type: ArgumentType.STRING,
                            menu: 'eventProperties',
                            defaultValue: 'TO'
                        }
                    }
                },
                {
                    // Required: the machine-readable name of this operation.
                    // This will appear in project JSON.
                    opcode: 'transfer',

                    // Required: the kind of block we're defining, from a predefined list:
                    // 'command' - a normal command block, like "move {} steps"
                    // 'reporter' - returns a value, like "direction"
                    // 'Boolean' - same as 'reporter' but returns a Boolean value
                    // 'hat' - starts a stack if its value is truthy
                    // 'conditional' - control flow, like "if {}" or "if {} else {}"
                    // A 'conditional' block may return the one-based index of a branch to
                    // run, or it may return zero/falsy to run no branch.
                    // 'loop' - control flow, like "repeat {} {}" or "forever {}"
                    // A 'loop' block is like a conditional block with two differences:
                    // - the block is assumed to have exactly one child branch, and
                    // - each time a child branch finishes, the loop block is called again.
                    blockType: BlockType.COMMAND,

                    // Required for conditional blocks, ignored for others: the number of
                    // child branches this block controls. An "if" or "repeat" block would
                    // specify a branch count of 1 an "if-else" block would specify a
                    // branch count of 2.
                    // TODO: should we support dynamic branch count for "switch"-likes?
                    branchCount: 0,

                    // Optional, default false: whether or not this block ends a stack.
                    // The "forever" and "stop all" blocks would specify true here.
                    terminal: false,

                    // Optional, default false: whether or not to block all threads while
                    // this block is busy. This is for things like the "touching color"
                    // block in compatibility mode, and is only needed if the VM runs in a
                    // worker. We might even consider omitting it from extension docs...
                    blockAllThreads: false,

                    // Required: the human-readable text on this block, including argument
                    // placeholders. Argument placeholders should be in [MACRO_CASE] and
                    // must be [ENCLOSED_WITHIN_SQUARE_BRACKETS].
                    text: formatMessage({
                        id: 'tokenBasic.transfer',
                        default: 'Transfer [VALUE] tokens to [TO]',
                        description: 'command text',
                    }),

                    // Required: describe each argument.
                    // Argument order may change during translation, so arguments are
                    // identified by their placeholder name. In those situations where
                    // arguments must be ordered or assigned an ordinal, such as interaction
                    // with Scratch Blocks, arguments are ordered as they are in the default
                    // translation (probably English).
                    arguments: {
                        // Required: the ID of the argument, which will be the name in the
                        // args object passed to the implementation function.
                        TO: {
                            // Required: type of the argument / shape of the block input
                            type: ArgumentType.STRING,
                            defaultValue: 'toAddress',
                        },
                        VALUE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0,
                        },
                    },
                },
                {
                    opcode: 'transferFrom',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'tokenBasic.transferFrom',
                        default: 'Transfer [VALUE] tokens from [FROM] to [TO]',
                        description: 'command text',
                    }),
                    arguments: {
                        FROM: {
                            type: ArgumentType.STRING,
                            defaultValue: 'fromAddress',
                        },
                        TO: {
                            type: ArgumentType.STRING,
                            defaultValue: 'toAddress',
                        },
                        VALUE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0,
                        },
                    },
                },
                {
                    opcode: 'approve',
                    blockType: BlockType.COMMAND,
                    text: formatMessage({
                        id: 'tokenBasic.approve',
                        default: 'Approve [VALUE] tokens to be spent by spender [SPENDER]',
                        description: 'command text',
                    }),
                    arguments: {
                        SPENDER: {
                            type: ArgumentType.STRING,
                            defaultValue: 'spenderAddress',
                        },
                        VALUE: {
                            type: ArgumentType.NUMBER,
                            defaultValue: 0,
                        },
                    },
                },
                {
                    opcode: 'balanceOf',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'tokenBasic.balanceOf',
                        default: 'Balance of [ADDRESS]',
                        description: 'command text',
                    }),
                    arguments: {
                        ADDRESS: {
                            type: ArgumentType.STRING,
                            defaultValue: 'ownerAddress',
                        },
                    },
                },
                {
                    opcode: 'allowance',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'tokenBasic.allowance',
                        default: 'Allowance from [OWNER] to [SPENDER]',
                        description: 'command text',
                    }),
                    arguments: {
                        OWNER: {
                            type: ArgumentType.STRING,
                            defaultValue: 'owner address',
                        },
                        SPENDER: {
                            type: ArgumentType.STRING,
                            defaultValue: 'spender address',
                        },
                    },
                },
                {
                    opcode: 'totalSupply',
                    blockType: BlockType.REPORTER,
                    text: formatMessage({
                        id: 'tokenBasic.totalSupply',
                        default: 'Total supply',
                        description: 'command text',
                    }),
                },
            ],

            menus: {
                events: [
                    {text: 'Transfer', value: 'Transfer'},
                    {text: 'TransferFrom', value: 'TransferFrom'},
                    {text: 'Approve', value: 'Approve'},
                ],
                eventProperties: [
                    {text: 'From', value: 'from'},
                    {text: 'To', value: 'to'},
                    {text: 'Value', value: 'value'},
                    {text: 'Owner', value: 'owner'},
                    {text: 'Spender', value: 'spender'},
                ],
            }
        }
    }

    setContract(args) {
        const methodName = 'setContractAddress'
        if (!args.ADDRESS || !args.ADDRESS.match(regEx.ethereumAddress)) {
            log.error(`Invalid address "${args.ADDRESS}" for the ${methodName} command. Must be a 40 char hexadecimal with a 0x prefix`)
            return
        }

        this.contract.setContract({
            contractAddress: args.ADDRESS,
            network: args.NETWORK_ID,
        })
    }

    deploy(args) {
        return this.contract.deploy(
            [args.TOTAL_SUPPLY],
            `deploy token contract with total supply of ${args.TOTAL_SUPPLY}`)
    }

    transfer(args)
    {
        const methodName = 'transfer'

        if (!args.TO || !args.TO.match(regEx.ethereumAddress)) {
            log.error(`Invalid TO address "${args.TO}" for the ${methodName} command. Must be a 40 char hexadecimal with a 0x prefix`)
            return
        }

        return this.contract.send(
            methodName,
            [args.TO, args.VALUE],
            `transfer ${args.VALUE} tokens to address ${args.TO}`)
    }

    transferFrom(args)
    {
        const methodName = 'transferFrom'

        if (!args.FROM || !args.FROM.match(regEx.ethereumAddress)) {
            log.error(`Invalid from address "${args.FROM}" for the ${methodName} command. Must be a 40 char hexadecimal with a 0x prefix`)
            return
        }
        if (!args.TO || !args.TO.match(regEx.ethereumAddress)) {
            log.error(`Invalid to address "${args.TO}" for the ${methodName} command. Must be a 40 char hexadecimal with a 0x prefix`)
            return
        }

        return this.contract.send(
            methodName,
            [args.TO, args.FROM, args.VALUE],
            `transfer ${args.VALUE} tokens from address ${args.FROM} to address ${args.TO}`)
    }

    approve(args)
    {
        const methodName = 'transferFrom'

        if (!args.SPENDER || !args.SPENDER.match(regEx.ethereumAddress)) {
            log.error(`Invalid spender address "${args.SPENDER}" for the ${methodName} command. Must be a 40 char hexadecimal with a 0x prefix`)
            return
        }

        return this.contract.send(
            methodName,
            [args.SPENDER, args.VALUE],
            `approve ${args.VALUE} tokens to be spent by spender address ${args.SPENDER}`)
    }

    allowance(args)
    {
        if (!args.OWNER || !args.OWNER.match(regEx.ethereumAddress)) {
            log.error(`Invalid owner address "${args.OWNER}" for the allowance command. Must be a 40 char hexadecimal with a 0x prefix`)
            return
        }
        if (!args.SENDER || !args.SENDER.match(regEx.ethereumAddress)) {
            log.error(`Invalid spender address "${args.SENDER}" for the allowance command. Must be a 40 char hexadecimal with a 0x prefix`)
            return
        }

        return this.contract.call(
            'allowance',
            [args.OWNER, args.SENDER],
            `get token allowance for spender ${args.SENDER} to transfer from owner ${args.OWNER}`)
    }

    balanceOf(args)
    {
        if (!args.ADDRESS || !args.ADDRESS.match(regEx.ethereumAddress)) {
            log.error(`Invalid ADDRESS address "${args.ADDRESS}" for the transfer command. Must be a 40 char hexadecimal with a 0x prefix`)
            return
        }

        return this.contract.call(
            'balanceOf',
            [args.ADDRESS],
            `get token balance of owner address ${args.ADDRESS}`)
    }

    totalSupply() {
        return this.contract.call(
            'totalSupply',
            [],
            `get total supply`)
    }
}
module.exports = ContractBlocks
