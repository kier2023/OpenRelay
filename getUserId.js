import { TwitterApi } from "twitter-api-v2";
import "dotenv/config";

const client = new TwitterApi(process.env.X_BEARER_TOKEN);

async function getUserId() {
  const user = await client.v2.userByUsername("@Your_X_Username");
  console.log(user.data.id);
}

getUserId();