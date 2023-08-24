const PostalMime = require("postal-mime");

async function email(message, env, ctx) {
    if (env.BLACK_LIST && env.BLACK_LIST.split(",").some(word => message.from.includes(word))) {
        message.setReject("Missing from address");
        console.log(`Reject message from ${message.from} to ${message.to}`);
        return;
    }
    if (!env.PREFIX || (message.to && message.to.startsWith(env.PREFIX))) {
        const reader = message.raw.getReader();
        const decoder = new TextDecoder("utf-8");
        let rawEmail = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            rawEmail += decoder.decode(value);
        }

        const parser = new PostalMime.default();
        const parsedEmail = await parser.parse(rawEmail);

        const { success } = await env.DB.prepare(
            `INSERT INTO mails (source, address, subject, message) VALUES (?, ?, ?, ?)`
        ).bind(message.from, message.to, parsedEmail.subject || "", parsedEmail.html).run();
        if (!success) {
            message.setReject(`Failed save message to ${message.to}`);
            console.log(`Failed save message from ${message.from} to ${message.to}`);
        }
    } else {
        message.setReject(`Unknown address ${message.to}`);
        console.log(`Unknown address ${message.to}`);
    }
}

export { email }