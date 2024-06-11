import {
  ACCOUNT_EMAIL,
  ACCOUNT_ID,
  API_HOST,
  API_KEY,
  API_TOKEN,
  API_TOKEN_1,
  API_TOKEN_2,
  API_TOKEN_3
} from "./constants.js";

if (!globalThis.fetch) {
  console.warn(
    "\nIMPORTANT: Your Node.js version doesn't have native fetch support and may not be supported in the future. Please update to v18 or later.\n"
  );
  // Advise what to do if running in GitHub Actions
  if (process.env.GITHUB_WORKSPACE)
    console.warn(
      "Since you're running in GitHub Actions, you should update your Actions workflow configuration to use Node v18 or higher."
    );
  // Import node-fetch since there's no native fetch in this environment
  globalThis.fetch = (await import("node-fetch")).default;
}

/**
 * Sends a message to a Discord-compatible webhook.
 * @param {url|string} url The webhook URL.
 * @param {string} message The message to be sent.
 * @returns {Promise}
 */
async function sendMessageToWebhook(url, message) {
  // Create the payload object with the message
  // The message is provided as 2 different properties to improve compatibility with webhook servers outside Discord
  const payload = { content: message, body: message };

  // Send a POST request to the webhook url with the payload as JSON
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    } else {
      return true;
    }
  } catch (error) {
    console.error('Error sending message to webhook:', error);
    return false;
  }
}

/**
 * Sends a CGPS notification to a Discord-compatible webhook.
 * Automatically checks if the webhook URL exists.
 * @param {string} msg The message to be sent.
 * @returns {Promise}
 */
export async function notifyWebhook(msg) {
  // Check if the webhook URL exists
  const webhook_url = process.env.DISCORD_WEBHOOK_URL;

  if (webhook_url && webhook_url.startsWith('http')) {
    // Send the message to the webhook
    try {
      await sendMessageToWebhook(webhook_url, `CGPS: ${msg}`);
    } catch (e) {
      console.error('Error sending message to Discord webhook:', e);
    }
  }
  // Not logging the lack of a webhook URL since it's not a feature everyone would use
}

/**
 * Fires request to the specified URL.
 * @param {string} url The URL to which the request will be fired.
 * @param {RequestInit} options The options to be passed to `fetch`.
 * @returns {Promise}
 */
const request = async (url, options) => {
  const tokens = [API_TOKEN_1, API_TOKEN_2, API_TOKEN_3, API_TOKEN].filter(Boolean);
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  let response;
  let data;
  let attempts = 0;
  let maxAttempts = 50;
  let tokenIndex = 0;

  while(attempts < maxAttempts) {
    const currentToken = tokens[tokenIndex];
    console.log(`Attempting request with token: ${currentToken}`);
    try {
      const headers = {
        Authorization: `Bearer ${currentToken}`,
        "Content-Type": "application/json",
        ...(currentToken === API_KEY && { "X-Auth-Email": ACCOUNT_EMAIL, "X-Auth-Key": API_KEY }),
      };

      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...headers,
        },
      });

      data = await response.json();

      if (!response.ok) {
        throw new Error('Response not OK');
      }
      return data;
    } catch (error) {
      console.warn(`An error occurred with token ${currentToken}: "${error.message}", switching token.`);
      tokenIndex = (tokenIndex + 1) % tokens.length; // Cycle through tokens
      attempts++;
      if(tokenIndex === 0) { // If we've gone through all tokens, wait before retrying
        await wait(5000);
      }
    }
  }
  throw new Error('All tokens failed after maximum attempts');
};


/**
 * Fires request to the Zero Trust gateway.
 * @param {string} path The path which will be appended to the request URL.
 * @param {RequestInit} options The options to be passed to `fetch`.
 * @returns {Promise}
 */
export const requestGateway = (path, options) =>
  request(`${API_HOST}/accounts/${ACCOUNT_ID}/gateway${path}`, options);

/**
 * Normalizes a domain.
 * @param {string} value The value to be normalized.
 * @param {boolean} isAllowlisting Whether the value is to be allowlisted.
 * @returns {string}
 */
export const normalizeDomain = (value, isAllowlisting) => {
  const normalized = value
    .replace(/(0\.0\.0\.0|127\.0\.0\.1|::1|::)\s+/, "")
    .replace("||", "")
    .replace("^$important", "")
    .replace("*.", "")
    .replace("^", "");

  if (isAllowlisting) return normalized.replace("@@||", "");

  return normalized;
};
