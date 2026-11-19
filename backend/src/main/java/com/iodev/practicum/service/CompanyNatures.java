package com.iodev.practicum.service;

import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.CompanyNature;

/**
 * Nature of business ng company. Kapag "Other" ang pinili, kailangan ang paliwanag (companies.nature_other),
 * at iyon ang ipinapakita sa halip na ang salitang "Other". Hindi idinadagdag sa listahan ng pagpipilian.
 */
public final class CompanyNatures {

    public static final int OTHER_MAX = 100;
    public static final String OTHER_REQUIRED = "Please specify the nature of business.";
    public static final String OTHER_TOO_LONG = "Keep it under " + OTHER_MAX + " characters.";

    private CompanyNatures() {}

    /** Ang "Other" na pagpipilian (ayon sa pangalan) */
    public static boolean isOther(CompanyNature n) {
        return n != null && n.getName() != null && n.getName().trim().equalsIgnoreCase("Other");
    }

    /** Nilinis na paliwanag: trim at isang espasyo; null kapag blangko */
    public static String cleanOther(String raw) {
        if (raw == null) return null;
        String s = raw.trim().replaceAll("\\s+", " ");
        return s.isEmpty() ? null : s;
    }

    /** Null kapag walang mali. Ang paliwanag ay kailangan lang kapag "Other" ang pinili. */
    public static String problem(CompanyNature n, String rawOther) {
        if (!isOther(n)) return null;
        String s = cleanOther(rawOther);
        if (s == null) return OTHER_REQUIRED;
        if (s.length() > OTHER_MAX) return OTHER_TOO_LONG;
        return null;
    }

    /** Ang ipinapakitang nature: ang paliwanag kapag "Other" at may laman; kung hindi, ang pangalan */
    public static String label(Company c) {
        if (c == null || c.getNature() == null) return null;
        if (isOther(c.getNature())) {
            String s = cleanOther(c.getNatureOther());
            if (s != null) return s;
        }
        return c.getNature().getName();
    }

    /** Ang isusulat sa nature_other: ang paliwanag lang kapag "Other", kung hindi ay null */
    public static String storedOther(CompanyNature n, String rawOther) {
        return isOther(n) ? cleanOther(rawOther) : null;
    }
}
