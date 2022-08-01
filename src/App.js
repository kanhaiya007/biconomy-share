import React from "react";
import { Magic } from "magic-sdk";
import Biconomy from "@biconomy/mexa/common-js/Biconomy";
import Web3 from "web3";
import abi from "./tempAbi.json";

let magicPublicKey = "pk_live_DA9A6B60D8EA59A1";

function App() {
    const [email, setEmail] = React.useState("");
    const [didToken, setDidToken] = React.useState("");
    const [address, setAddress] = React.useState("");

    const magicLogin = async () => {
        const magicInstance = new Magic(magicPublicKey, {
            network: {
                rpcUrl: "https://polygon-mumbai.infura.io/v3/a6379507c3f24447aa3ce9ba15f4790a",
                chainId: "80001",
            },
        });
        const didToken = await magicInstance.auth.loginWithMagicLink({
            email: email,
        });
        if (didToken) setDidToken(didToken);
        const { publicAddress } = await magicInstance.user.getMetadata();
        setAddress(publicAddress);
    };

    const getSignatureParametersWeb3 = async (signature) => {
        const magicInstance = new Magic(magicPublicKey, {
            network: {
                rpcUrl: "https://polygon-mumbai.infura.io/v3/a6379507c3f24447aa3ce9ba15f4790a",
                chainId: "80001",
            },
        });
        const web3 = new Web3(magicInstance.rpcProvider);
        if (!web3.utils.isHexStrict(signature)) {
            throw new Error(
                'Given value "'.concat(
                    signature,
                    '" is not a valid hex string.'
                )
            );
        }
        const r = signature.slice(0, 66);
        const s = "0x".concat(signature.slice(66, 130));
        let v = "0x".concat(signature.slice(130, 132));
        v = web3.utils.hexToNumber(v).toString();
        if (![27, 28].includes(Number(v))) v += 27;
        return {
            r: r,
            s: s,
            v: Number(v),
        };
    };

    const executeMetaTransaction = async () => {
        let config = {
            contract: {
                address: "0xF899aA3d6E9E3649884C1414D3e53bF24597Fb7b",
                abi: abi,
            },
            apiKey: {
                test: "1d7Es20Mg.144bcde9-0c6e-45a8-a7b8-dbd403dc88e4",
            },
        };
        const domainType = [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "verifyingContract", type: "address" },
            { name: "salt", type: "bytes32" },
        ];
        const metaTransactionType = [
            { name: "nonce", type: "uint256" },
            { name: "from", type: "address" },
            { name: "functionSignature", type: "bytes" },
        ];
        let domainData = {
            name: "Vybo_test_contract",
            version: "1",
            verifyingContract: "0x4c97b29b2B1b4215f1277B6cC3E7CCb95afD29f1",
            salt: "0x" + (80001).toString(16).padStart(64, "0"),
        };

        const magicInstance = new Magic(magicPublicKey, {
            network: {
                rpcUrl: "https://polygon-mumbai.infura.io/v3/a6379507c3f24447aa3ce9ba15f4790a",
                chainId: "80001",
            },
        });

        const biconomy = new Biconomy(magicInstance.rpcProvider, {
            apiKey: config.apiKey.test,
            debug: true,
        });

        let web3 = new Web3(biconomy);
        let walletweb3 = new Web3(magicInstance.rpcProvider);
        let contract;
        biconomy
            .onEvent(biconomy.READY, async () => {
                // Initialize your dapp here like getting user accounts etc
                console.log("Biconomy Initialized.");
                contract = new web3.eth.Contract(
                    config.contract.abi,
                    config.contract.address
                );
                console.log("Sending Meta Transaction");
                let nonce = await contract.methods.getNonce(address).call();
                let functionSignature = contract.methods
                    .mint(address, [
                        "QmVL21DWdQ9Qd6uuMYLpwPFdFh5uzJ8hadMf9hSjrFXVMN",
                    ])
                    .encodeABI();
                let message = {};
                message.nonce = parseInt(nonce);
                message.from = address;
                message.functionSignature = functionSignature;
                const dataToSign = {
                    types: {
                        EIP712Domain: domainType,
                        MetaTransaction: metaTransactionType,
                    },
                    domain: domainData,
                    primaryType: "MetaTransaction",
                    message: message,
                };

                walletweb3.currentProvider.send(
                    {
                        jsonrpc: "2.0",
                        id: 1,
                        method: "eth_signTypedData_v4",
                        params: [address, dataToSign],
                    },
                    async function (error, response) {
                        console.info(`User signature is ${response.result}`);
                        if (error || (response && response.error)) {
                            // showErrorMessage('Could not get user signature');
                            console.log(response, error);
                        } else if (response && response.result) {
                            let { r, s, v } = await getSignatureParametersWeb3(
                                response.result
                            );
                            // sendSignedTransaction(userAddress, functionSignature, r, s, v);
                            try {
                                // let gasLimit = await contract.methods
                                //   .executeMetaTransaction(address, functionSignature, r, s, v)
                                //   .estimateGas({ from: address });
                                // let gasPrice = await web3.eth.getGasPrice();
                                console.log(
                                    address,
                                    functionSignature,
                                    r,
                                    s,
                                    v
                                );
                                let tx = contract.methods
                                    .executeMetaTransaction(
                                        address,
                                        functionSignature,
                                        r,
                                        s,
                                        v
                                    )
                                    .send({
                                        from: address,
                                    });

                                tx.on("transactionHash", function (hash) {
                                    console.log(`Transaction hash is ${hash}`);
                                    // showInfoMessage(`Transaction sent by relayer with hash ${hash}`);
                                }).once(
                                    "confirmation",
                                    function (confirmationNumber, receipt) {
                                        console.log(receipt);
                                        // setTransactionHash(receipt.transactionHash);
                                        // showSuccessMessage('Transaction confirmed on chain');
                                        // getQuoteFromNetwork();
                                    }
                                );
                            } catch (error) {
                                console.log(error);
                            }
                        }
                    }
                );
            })
            .onEvent(biconomy.ERROR, (error, message) => {
                // Handle error while initializing mexa
                console.log("Biconomy Initialize Failed", error, message);
            });
    };

    return (
        <div className="App">
            {!didToken && (
                <>
                    <p>Ensure correct email / will be saved nowhere.</p>
                    <input
                        value={email}
                        type="email"
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </>
            )}
            {didToken ? (
                <button onClick={executeMetaTransaction}>
                    Execute Meta transaction
                </button>
            ) : (
                <button onClick={magicLogin}>Connect with magic</button>
            )}
        </div>
    );
}

export default App;
