package com.iodev.practicum.service;

/**
 * Isang pagbabagong nasuri na pero hindi pa naisusulat. Ginagamit ng mga service para iisa ang
 * pagsusuri ng normal na form at ng report (preview muna, saka isusulat kapag kinumpirma).
 *
 * @param label    pangalan ng field para sa tao
 * @param oldValue kasalukuyang halaga sa system
 * @param newValue halagang isusulat
 * @param affected ilang student ang tatamaan
 * @param write    ang mismong pagsulat; null kapag walang babaguhin
 */
public record PreparedChange(String label, String oldValue, String newValue, long affected, Runnable write) {

    public boolean unchanged() {
        return write == null;
    }

    public void run() {
        if (write != null) write.run();
    }
}
