package com.iodev.practicum.config;

import com.iodev.practicum.service.BuiltInRequirementService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Sa pag-start ng app, dinadagdag ang kulang na built-in para sa mga umiiral na coordinator at semester.
 * Dito ito at hindi sa unang pagbukas dahil readOnly ang mga transaction ng mga pahinang nagbabasa nito.
 * Kapag pumalya, itatala lang at uulitin sa susunod na start; hindi dapat nito pigilan ang app.
 */
@Component
public class BuiltInRequirementBackfill implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BuiltInRequirementBackfill.class);

    private final BuiltInRequirementService service;

    public BuiltInRequirementBackfill(BuiltInRequirementService service) {
        this.service = service;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            int changed = service.ensureAll();
            if (changed > 0) log.info("Built-in requirements: {} added or converted.", changed);
        } catch (RuntimeException e) {
            log.error("Built-in requirements could not be created. Will retry on the next start.", e);
        }
    }
}
