package com.iodev.practicum.controller;

import com.iodev.practicum.service.RequirementStorage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

/**
 * Para sa local na pag-develop lang (kapag naka-set ang app.storage.local-dir): ang pinirmahang link
 * na ibinibigay ng RequirementStorage sa halip na S3 presigned URL. Sa production (S3) ay laging 404.
 */
@RestController
@RequestMapping("/api/public/local-files")
public class LocalFileController {

    @Autowired private RequirementStorage storage;

    @GetMapping
    public ResponseEntity<?> get(@RequestParam String key, @RequestParam long exp, @RequestParam String sig) {
        if (!storage.validLocalLink(key, exp, sig)) return ResponseEntity.notFound().build();
        RequirementStorage.Opened in;
        try {
            in = storage.open(key);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
        String name = key.substring(key.lastIndexOf('/') + 1);
        MediaType type = MediaTypeFactory.getMediaType(name).orElse(MediaType.APPLICATION_OCTET_STREAM);
        ResponseEntity.BodyBuilder ok = ResponseEntity.ok()
                .contentType(type)
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(name, StandardCharsets.UTF_8).build().toString());
        if (in.length() != null) ok.contentLength(in.length());
        return ok.body(new InputStreamResource(in.stream()));
    }
}
