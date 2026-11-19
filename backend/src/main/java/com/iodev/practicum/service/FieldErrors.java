package com.iodev.practicum.service;

import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Mga error bawat field ng form (hal. "supervisorEmail", "departments[1].name"). Ibinabalik bilang
 * 400 na may {"message": unang error, "fieldErrors": {...}} para maipakita ng form ang bawat isa sa ilalim ng field.
 */
public class FieldErrors {

    private final Map<String, String> errors = new LinkedHashMap<>();

    /** Ang unang error lang ng bawat field ang itinatabi */
    public FieldErrors add(String field, String message) {
        errors.putIfAbsent(field, message);
        return this;
    }

    public boolean isEmpty() {
        return errors.isEmpty();
    }

    public Map<String, String> map() {
        return errors;
    }

    public ResponseEntity<?> toResponse() {
        String first = errors.values().stream().findFirst().orElse("Please check the form.");
        return ResponseEntity.badRequest().body(Map.of("message", first, "fieldErrors", errors));
    }
}
