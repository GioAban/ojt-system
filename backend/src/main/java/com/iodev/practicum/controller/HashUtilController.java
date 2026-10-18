package com.iodev.practicum.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/temp")
public class HashUtilController {

    @Autowired
    private PasswordEncoder passwordEncoder;

    @GetMapping("/hash")
    public String hash(@RequestParam String password) {
        return passwordEncoder.encode(password);
    }
}