package com.iodev.practicum.service;

import org.springframework.http.ResponseEntity;

/**
 * Error mula sa isang service na may kasamang HTTP status, para maibalik ng controller ang
 * eksaktong parehong sagot gaya ng dati (status at mensahe).
 */
public class ActionException extends RuntimeException {

    private final int status;

    public ActionException(int status, String message) {
        super(message);
        this.status = status;
    }

    public static ActionException bad(String message) {
        return new ActionException(400, message);
    }

    public static ActionException forbidden(String message) {
        return new ActionException(403, message);
    }

    public static ActionException conflict(String message) {
        return new ActionException(409, message);
    }

    public int getStatus() {
        return status;
    }

    public ResponseEntity<?> toResponse() {
        return ResponseEntity.status(status).body(getMessage());
    }
}
