package com.iodev.practicum.mail;

/** Ang nagpapadala ng email (AWS SES, o console lang sa local dev) */
public interface MailProvider {

    /** Pangalan para sa log, hal. "ses" o "log" */
    String name();

    /**
     * Ipinapadala ang email. Ibinabalik ang message ID ng provider (null kung wala).
     * Nagbabato ng exception kapag hindi naipadala; ang MailService ang nagla-log.
     */
    String send(MailMessage message, String fromHeader, String replyTo);
}
