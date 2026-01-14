import dotenv from 'dotenv';
dotenv.config();

export const config = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    apiKey: process.env.API_KEY,
    imsOrg: process.env.IMS_ORG,
    sandboxName: process.env.SANDBOX_NAME,
    imsUrl: process.env.IMS_URL || 'https://ims-na1.adobelogin.com',
    platformUrl: process.env.PLATFORM_URL || 'https://platform.adobe.io',
    scopes: process.env.SCOPES || 'openid,AdobeID,read_organizations',
    port: process.env.PORT || 3001
};

// Allow dynamic sandbox switching
export function setSandboxName(sandbox) {
    if (sandbox) {
        config.sandboxName = sandbox;
        console.log(`[Config] Sandbox switched to: ${sandbox}`);
    }
}

export function getSandboxName() {
    return config.sandboxName;
}
