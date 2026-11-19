package com.iodev.practicum.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Para gumana ang @Scheduled (hal. paglilinis ng hindi na-verify na registration at lumang email token).
 * Ang pagpapadala ng email ay may sariling maliit na thread pool sa MailService.
 */
@Configuration
@EnableScheduling
public class BackgroundConfig {
}
