package com.iodev.practicum.mail;

/** Isang email na handa nang ipadala (nai-render na ang text at HTML) */
public record MailMessage(String to, String subject, String text, String html) {}
