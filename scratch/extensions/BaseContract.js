const log = require('minilog')('eth-scratch3:BaseContract')
const VError = require('verror')
const EventEmitter = require('events')

class BaseContract {

    constructor(Contract, options = {}) {

        this.Contract = Contract
        this.eventEmitter = new EventEmitter()

        if (typeof web3 === 'undefined') {
            log.warn('MetaMask is not installed so will load web3 locally')
            Web3 = require('web3')
            this.web3Client = new Web3(options.provider)
        }
        else {
            // ethereum.enable()
            if (web3 && web3.version) {
                log.debug(`Using injected web3 version ${web3.version.api}`)
            }
            else {
                log.error(`Could not get version of injected web3`)
            }

            this.web3Client = new Web3(web3.currentProvider)
        }

        this.setContract(options)
    }

    setContract(options)
    {
        this.network = options.network || 3 // default to the Ropsten network
        this.contractAddress = options.contractAddress || this.Contract.networks[this.network].address

        this.contract = this.web3Client.eth.contract(this.Contract.abi).at(this.contractAddress)

        log.debug(`Set contract to address ${this.contractAddress} for network ${this.network}`)

        this.startWatchingEvents()
    }

    deploy(params, description)
    {
        return new Promise((resolve, reject) => {

            const deployDescription = `${description} to network with id ${web3.version.network} with params ${JSON.stringify(params)}`

            log.debug(`About to ${deployDescription}`)

            this.contract = web3.eth.contract(this.Contract.abi)

            this.contract.new(
                ...params,
                {data: this.Contract.bytecode},
                (err, contract) =>
            {
                if(err) {
                    const error = new VError(err, `Failed to ${deployDescription}.`)
                    log.error(error.stack)
                    return reject(error)
                }

                if(!contract.address) {
                    log.info(`Got transaction hash ${contract.transactionHash} for ${deployDescription}`)
                }
                else {
                    this.setContract({
                        contractAddress: contract.address,
                        network: web3.version.network
                    })

                    resolve(contract.address)
                }
            })
        })
    }

    send(methodName, args, description)
    {
        return new Promise((resolve, reject) => {

            const sendDescription = `${description} using contract with address ${this.contractAddress}`

            log.debug(`About to ${sendDescription}`)

            this.contract[methodName].sendTransaction(...args, (err, transactionHash) =>
            {
                if(err) {
                    const error = new VError(err, `Failed to ${sendDescription}.`)
                    log.error(error.stack)
                    return reject(error)
                }

                log.info(`Got transaction hash ${transactionHash} for ${sendDescription}`)

                resolve(transactionHash)
            })
        })
    }

    call(methodName, args, description)
    {
        return new Promise((resolve, reject) => {

            const callDescription = `${description} using contract with address ${this.contractAddress}`

            log.debug(`About to ${callDescription} calling method name ${methodName}`)

            this.contract[methodName](...args, (err, returnedValue) =>
            {
                if(err) {
                    const error = new VError(err, `Failed to ${callDescription}.`)
                    log.error(error.stack)
                    return reject(error)
                }

                log.info(`Got ${returnedValue} from ${callDescription}`)

                resolve(returnedValue)
            })
        })
    }

    startWatchingEvents() {

        const eventDescription = `watching for events on contract with address ${this.contractAddress}`

        log.debug(`Start ${eventDescription}`)

        this.contract.allEvents().watch((err, event) =>
        {
            if (err) {
                const error = new VError(err, `Failed ${eventDescription}.`)
                log.error(error.stack)
                return callback(error)
            }

            log.info(`Got event ${event.event} from contract ${this.contractAddress}: ${JSON.stringify(event)}`)

            this.eventEmitter.emit(event.event, event)
        })
    }
}

module.exports = BaseContract
