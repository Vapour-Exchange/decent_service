import { TonClient, toNano } from "@ton/ton";
import { DEX, pTON } from "@ston-fi/sdk"


const client = new TonClient({
  endpoint: "https://toncenter.com/api/v2/jsonRPC",
});


export async function swapJettonToJetton() {
  try {
    console.log("Called");

    // Initialize the router
    const router = client.open(
      DEX.v1.Router.create(
        "kQCas2p939ESyXM_BzFJzcIe3GD5S0tbjJDj6EBVn-SPsEkN" // Router address
      )
    );

    console.log("Router initialized:", router);

    // Prepare the transaction parameters
    const txParams = await router.getSwapJettonToJettonTxParams({
      userWalletAddress: "0QDZCwEV1RTaskFt1c1VJg1EP36jejpxyd8l0WSX0wI9Zz4p", // ! replace with your address
      offerJettonAddress: "EQA2kCVNwVsil2EM2mB0SkXytxCqQjS4mttjDpnXmwG9T6bO", // STON
      offerAmount: toNano("1"),
      askJettonAddress: "EQBX6K9aXVl3nXINCyPPL86C4ONVmQ8vK360u6dykFKXpHCa", // GEMSTON
      minAskAmount: "1",
      queryId: 12345,
    });

    console.log("Transaction parameters:", txParams);

    // Return the transaction parameters to the calling function
    return txParams;
  } catch (error) {
    console.error("Error during Jetton-to-Jetton swap:", error);
    throw error;
  }
}


