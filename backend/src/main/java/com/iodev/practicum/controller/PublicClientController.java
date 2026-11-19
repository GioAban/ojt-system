package com.iodev.practicum.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Para sa offline mode ng app (walang login; nasa /api/public/** na permitAll).
 * - /ping: totoong pagsusuri kung naaabot ang server (hindi sapat ang navigator.onLine).
 * - /client-config: kill switch ng service worker. APP_SW_ENABLED=false = aalisin ng app ang service worker
 *   at ang cache ng app sa susunod na pagbukas, nang hindi na kailangang mag-deploy ng bagong frontend.
 */
@RestController
@RequestMapping("/api/public")
public class PublicClientController {

    @Value("${app.client.service-worker-enabled:true}")
    private boolean serviceWorkerEnabled;

    @GetMapping("/ping")
    public ResponseEntity<Void> ping() {
        return ResponseEntity.noContent().cacheControl(CacheControl.noStore()).build();
    }

    @GetMapping("/client-config")
    public ResponseEntity<Map<String, Object>> clientConfig() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(Map.of("serviceWorker", serviceWorkerEnabled));
    }
}
