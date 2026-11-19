package com.iodev.practicum.mail;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Para sa local dev (walang MAIL_PROVIDER o walang MAIL_FROM): walang ipinapadala, ipinapakita lang sa console
 * ang email kasama ang link, kagaya ng local na storage ng file. HUWAG gamitin sa production.
 */
public class LogMailProvider implements MailProvider {

    private static final Logger log = LoggerFactory.getLogger(LogMailProvider.class);

    @Override
    public String name() {
        return "log";
    }

    @Override
    public String send(MailMessage m, String fromHeader, String replyTo) {
        log.info("""

                ===================== EMAIL (not sent, local mode) =====================
                To:      {}
                From:    {}
                Subject: {}
                ------------------------------------------------------------------------
                {}
                ========================================================================""",
                m.to(), fromHeader, m.subject(), m.text());
        return null;
    }
}
