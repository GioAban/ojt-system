package com.iodev.practicum.mail;

import java.util.List;

/**
 * Ang laman ng isang email bago i-render. Isang button lang (buttonLabel + url), puwedeng wala.
 * Walang personal na datos maliban sa first name.
 */
public record MailContent(
        String college,
        String subject,
        String heading,
        List<String> paragraphs,
        String buttonLabel,
        String url,
        String note) {}
