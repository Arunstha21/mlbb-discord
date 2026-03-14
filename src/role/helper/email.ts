import { getLogger } from "../../util/logger";
import credentials from "../../../credentials.json";

const logger = getLogger("email");

let access_token: string = '';
let expiry: Date = new Date(Date.now() - 120 * 1000);

function isTokenExpired(): boolean {
    const currentTime = new Date();
    return expiry < currentTime;
}

async function refreshAccessToken(): Promise<void> {
    if (!isTokenExpired()) return;

    logger.info('Google API access token expired. Refreshing token.');

    const payload = new URLSearchParams({
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        refresh_token: credentials.refreshToken,
        grant_type: 'refresh_token',
    });

    try {
        const response = await fetch(credentials.tokenUri, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: payload.toString(),
        });

        if (!response.ok) {
            logger.error('Failed to refresh access token');
            return;
        }

        const responseJson = await response.json() as { access_token: string, expires_in: number };
        access_token = responseJson.access_token;
        const expiry_in: number = responseJson.expires_in;
        expiry = new Date(Date.now() + (expiry_in - 180) * 1000);
    } catch (error) {
        logger.error('Exception while refreshing access token:', error);
    }
}

export async function sendEmail(to: string, otp: number): Promise<void> {
    await refreshAccessToken();

    const sender = 'leagueops@nodwin.com';
    const subject = 'OTP for Discord Verification';
    const message = `Your OTP for Discord Verification is: ${otp}`;

    const messageBytes = `From: ${sender}\nTo: ${to}\nSubject: ${subject}\n\n${message}`;

    const base64Encoded = Buffer.from(messageBytes)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

    const payload = { raw: base64Encoded };

    try {
        const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            logger.info(`Mail successfully sent to: ${to}, Subject: ${subject}`);
        } else {
            logger.error(`Error sending email to: ${to}`);
        }
    } catch (error) {
        logger.error(`Exception while sending email to ${to}:`, error);
    }
}
