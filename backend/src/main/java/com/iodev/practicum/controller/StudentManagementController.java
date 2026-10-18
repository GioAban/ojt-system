package com.iodev.practicum.controller;

import com.iodev.practicum.dto.StudentManagementDtos.*;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.util.DefaultPassword;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.apache.poi.ss.usermodel.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Student management ng coordinator: list, add, inline edit, archive/restore,
 * reset password, detail, at bulk import (xlsx/xls/csv).
 */
@RestController
@RequestMapping("/api/coordinator/student-management")
public class StudentManagementController {

    private static final Pattern NUMBER = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9\\-/]{2,49}$");
    private static final Pattern PHONE = Pattern.compile("^[0-9+()\\-\\s]{7,20}$");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final int MAX_IMPORT_ROWS = 500;

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private StudentManagementRepository repository;
    @Autowired private PasswordEncoder passwordEncoder;
    @PersistenceContext private EntityManager em;

    /** Mali ang input; ginagamit sa loob ng mga validator */
    private static class Invalid extends RuntimeException {
        Invalid(String message) { super(message); }
    }

    // ---------------------------------------------------------------------
    // Listahan
    // ---------------------------------------------------------------------

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<StudentRow> rows = new ArrayList<>();
        for (Student s : repository.findForManagement(coordinator.getId(), semesterId)) {
            rows.add(toRow(s));
        }
        Program p = coordinator.getProgram();
        return ResponseEntity.ok(new StudentListResponse(
                semesterId,
                p == null ? null : p.getName(),
                p == null ? null : p.getAbbreviation(),
                rows));
    }

    // ---------------------------------------------------------------------
    // Add
    // ---------------------------------------------------------------------

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody StudentCreateRequest r, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        if (r == null || r.semesterId() == null) return bad("Choose a semester first.");

        try {
            String number = validNumber(r.studentNumber());
            String last = validName(r.lastname(), "Last name");
            String first = validName(r.firstname(), "First name");
            String mi = validInitial(r.middleInitial());
            String gender = validGender(r.gender());
            String year = validYear(r.year());
            String course = validCourse(r.course());

            if (repository.numberExists(number, r.semesterId())) {
                return ResponseEntity.status(409).body("That student number already exists in this semester.");
            }

            Student s = build(coordinator, r.semesterId(), number, last, first, mi, gender, year, course);
            repository.save(s);
            return ResponseEntity.ok(toRow(s));
        } catch (Invalid e) {
            return bad(e.getMessage());
        }
    }

    // ---------------------------------------------------------------------
    // Inline edit
    // ---------------------------------------------------------------------

    @PatchMapping("/{id}")
    @Transactional
    public ResponseEntity<?> edit(@PathVariable Long id, @RequestBody StudentEdit request,
                                  Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");

        String field = request == null || request.field() == null ? "" : request.field();
        String raw = request == null ? null : request.value();
        Long semesterId = s.getSemester().getId();

        try {
            switch (field) {
                case "studentNumber" -> {
                    String v = validNumber(raw);
                    if (repository.numberExistsExcluding(v, semesterId, id)) {
                        return ResponseEntity.status(409).body("That student number already exists in this semester.");
                    }
                    s.setStudentNumber(v);
                }
                case "lastname" -> s.setLastname(validName(raw, "Last name"));
                case "firstname" -> s.setFirstname(validName(raw, "First name"));
                case "middleInitial" -> s.setMiddleInitial(validInitial(raw));
                case "gender" -> s.setGender(validGender(raw));
                case "year" -> s.setYear(validYear(raw));
                case "course" -> {
                    String v = validCourse(raw);
                    if (v == null) return bad("Course is required.");
                    s.setSubjectCode(v);
                }
                case "contact" -> s.setContact(validContact(raw));
                case "email" -> {
                    if (!hasAccount(s)) {
                        return ResponseEntity.status(409).body("Create the account first, then you can change the email.");
                    }
                    String v = validEmail(raw);
                    if (repository.emailExistsExcluding(v, id)) {
                        return ResponseEntity.status(409).body("That email is already used by another student.");
                    }
                    s.setEmail(v);
                }
                case "birthday" -> s.setBirthday(validBirthday(raw));
                case "address" -> s.setAddress(validAddress(raw));
                case "parent" -> s.setParent(validShortText(raw, "Parent"));
                case "guardian" -> s.setGuardian(validShortText(raw, "Guardian"));
                default -> { return bad("That field can't be edited here."); }
            }
        } catch (Invalid e) {
            return bad(e.getMessage());
        }

        repository.save(s);
        return ResponseEntity.ok(toRow(s));
    }

    // ---------------------------------------------------------------------
    // Archive / restore / reset password
    // ---------------------------------------------------------------------

    @PatchMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<?> archive(@PathVariable Long id, @RequestParam boolean archived,
                                     Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");

        s.setIsArchived(archived);
        repository.save(s);
        return ResponseEntity.ok(toRow(s));
    }

    /** Ang coordinator ang nagtatakda ng bagong password ng student na may account na */
    @PostMapping("/{id}/password")
    @Transactional
    public ResponseEntity<?> setPassword(@PathVariable Long id, @RequestBody SetPasswordRequest request,
                                         Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");
        if (!hasAccount(s)) {
            return ResponseEntity.status(409).body("This student hasn't created an account yet.");
        }

        String password = request == null || request.password() == null ? "" : request.password();
        if (password.length() < 8) return bad("Password must be at least 8 characters.");
        if (password.length() > 72) return bad("Password is too long (max 72 characters).");

        s.setPassword(passwordEncoder.encode(password));
        s.setTemporaryPassword(null);
        s.setMustChangePassword(true);
        repository.save(s);
        return ResponseEntity.ok().build();
    }

    /** Manu-manong paggawa ng account: email lang ang kailangan; default password (ID + initials) */
    @PostMapping("/{id}/create-account")
    @Transactional
    public ResponseEntity<?> createAccount(@PathVariable Long id, @RequestBody CreateAccountRequest request,
                                           Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");
        if (Boolean.TRUE.equals(s.getIsArchived())) return ResponseEntity.status(409).body("Restore the student first.");
        if (hasAccount(s)) return ResponseEntity.status(409).body("This student already has an account.");

        String email = request == null || request.email() == null ? "" : request.email().trim().toLowerCase();
        if (email.isEmpty() || email.length() > 255 || !EMAIL.matcher(email).matches()) return bad("Enter a valid email.");
        if (repository.emailExistsExcluding(email, s.getId())) {
            return ResponseEntity.status(409).body("That email is already used by another account.");
        }

        String password = DefaultPassword.of(s);
        s.setEmail(email);
        s.setPassword(passwordEncoder.encode(password));
        s.setTemporaryPassword(null);
        s.setIsVerified(true);
        s.setMustChangePassword(true);
        repository.save(s);
        return ResponseEntity.ok(new ApprovalResult(s.getId(), s.getLastname() + ", " + s.getFirstname(), email, password));
    }

    /** Ibinabalik ang password sa default (ID + initials); kailangang magpalit ulit ang student */
    @PostMapping("/{id}/reset-password")
    @Transactional
    public ResponseEntity<?> resetPassword(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");
        if (!hasAccount(s)) return ResponseEntity.status(409).body("This student hasn't created an account yet.");

        String password = DefaultPassword.of(s);
        s.setPassword(passwordEncoder.encode(password));
        s.setTemporaryPassword(null);
        s.setMustChangePassword(true);
        repository.save(s);
        return ResponseEntity.ok(new ApprovalResult(s.getId(), s.getLastname() + ", " + s.getFirstname(), s.getEmail(), password));
    }

    /** Binabawi ang account: puwedeng mag-claim ulit ang student gamit ang QR */
    @PostMapping("/{id}/reset-account")
    @Transactional
    public ResponseEntity<?> resetAccount(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");

        s.setEmail(null);
        s.setPassword(unusablePassword());
        s.setTemporaryPassword(null);
        s.setIsVerified(false);
        s.setMustChangePassword(false);
        repository.save(s);
        return ResponseEntity.ok(toRow(s));
    }

    // ---------------------------------------------------------------------
    // Detail (drawer)
    // ---------------------------------------------------------------------

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> detail(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only view your own students.");

        Department d = s.getDepartment();
        Company c = d == null ? null : d.getCompany();

        return ResponseEntity.ok(new StudentDetail(
                toRow(s), s.getParent(), s.getGuardian(), s.getMoaStatus(),
                s.getDeployedDate(), s.getStartTrainingDate(), s.getCompletedDate(),
                s.getRenderedHours(), s.getTrainingDuration(),
                c == null ? null : c.getAddress(),
                d == null ? null : d.getSupervisorFullname(),
                d == null ? null : d.getSupervisorPosition(),
                s.getEmployabilityLevel(),
                new LinkedHashMap<>()));
    }

    // ---------------------------------------------------------------------
    // Bulk import
    // ---------------------------------------------------------------------

    @GetMapping("/import/template")
    public ResponseEntity<byte[]> template() {
        String csv = "No.,Student ID,Lastname,Firstname,MI.,Course,Student Year,Gender\r\n"
                + "1,2021-00123,Dela Cruz,Juan,A,BSIT,4th Year,Male\r\n"
                + "2,2021-00456,Santos,Maria,,BSIT,4th Year,Female\r\n";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"students-template.csv\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(("\uFEFF" + csv).getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/import/preview")
    @Transactional(readOnly = true)
    public ResponseEntity<?> preview(@RequestParam Long semesterId,
                                     @RequestParam("file") MultipartFile file,
                                     Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        if (file == null || file.isEmpty()) return bad("Choose a file to import.");

        List<List<String>> table;
        try {
            table = readTable(file);
        } catch (Exception e) {
            return bad("We couldn't read that file. Use the template (.csv, .xlsx or .xls).");
        }
        if (table.size() < 2) return bad("The file has no student rows.");
        if (table.size() - 1 > MAX_IMPORT_ROWS) {
            return bad("Too many rows (max " + MAX_IMPORT_ROWS + " per import).");
        }

        Map<String, Integer> col = mapHeader(table.get(0));
        List<String> required = List.of("studentNumber", "lastname", "firstname", "gender");
        for (String k : required) {
            if (!col.containsKey(k)) return bad("Missing column: " + headerLabel(k) + ". Use the template.");
        }

        List<ImportRow> rows = new ArrayList<>();
        Set<String> seenNumbers = new HashSet<>();
        int valid = 0;

        for (int i = 1; i < table.size(); i++) {
            List<String> cells = table.get(i);
            if (cells.stream().allMatch(x -> x == null || x.isBlank())) continue;

            ImportRow row = validateImportRow(i + 1, cell(cells, col, "studentNumber"),
                    cell(cells, col, "lastname"), cell(cells, col, "firstname"),
                    cell(cells, col, "middleInitial"), cell(cells, col, "gender"),
                    cell(cells, col, "year"), cell(cells, col, "course"),
                    semesterId, seenNumbers);
            if (row.errors().isEmpty()) valid++;
            rows.add(row);
        }
        // Alphabetical by lastname, kahit walang No. column
        rows.sort(BY_NAME);
        return ResponseEntity.ok(new ImportPreview(rows.size(), valid, rows.size() - valid, rows));
    }

    @PostMapping("/import")
    @Transactional
    public ResponseEntity<?> commit(@RequestBody ImportCommitRequest request, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        if (request == null || request.semesterId() == null || request.rows() == null) {
            return bad("Nothing to import.");
        }
        if (request.rows().size() > MAX_IMPORT_ROWS) {
            return bad("Too many rows (max " + MAX_IMPORT_ROWS + " per import).");
        }

        int created = 0, skipped = 0;
        List<ImportRowError> errors = new ArrayList<>();
        Set<String> seenNumbers = new HashSet<>();

        List<ImportRow> ordered = new ArrayList<>(request.rows());
        ordered.sort(BY_NAME);

        for (ImportRow in : ordered) {
            // Revalidate sa server; hindi tayo nagtitiwala sa preview ng client
            ImportRow row = validateImportRow(in.line(), in.studentNumber(), in.lastname(), in.firstname(),
                    in.middleInitial(), in.gender(), in.year(), in.course(),
                    request.semesterId(), seenNumbers);
            if (!row.errors().isEmpty()) {
                skipped++;
                errors.add(new ImportRowError(row.line(), String.join(" ", row.errors())));
                continue;
            }
            Student s = build(coordinator, request.semesterId(), row.studentNumber(), row.lastname(),
                    row.firstname(), row.middleInitial(), row.gender(), row.year(), row.course());
            repository.save(s);
            created++;
        }
        return ResponseEntity.ok(new ImportCommitResult(created, skipped, errors));
    }

    // ---------------------------------------------------------------------
    // Import helpers
    // ---------------------------------------------------------------------

    private static final Comparator<ImportRow> BY_NAME = Comparator
            .comparing((ImportRow r) -> r.lastname() == null ? "" : r.lastname().toLowerCase())
            .thenComparing(r -> r.firstname() == null ? "" : r.firstname().toLowerCase());

    private ImportRow validateImportRow(int line, String number, String last, String first, String mi,
                                        String gender, String year, String course, Long semesterId,
                                        Set<String> seenNumbers) {
        List<String> errors = new ArrayList<>();

        String n = attempt(errors, () -> validNumber(number));
        String l = attempt(errors, () -> validName(last, "Last name"));
        String f = attempt(errors, () -> validName(first, "First name"));
        String m = attempt(errors, () -> validInitial(mi));
        String g = attempt(errors, () -> validGender(gender));
        String y = attempt(errors, () -> validYear(year));
        String c = attempt(errors, () -> validCourse(course));

        if (n != null) {
            if (!seenNumbers.add(n.toLowerCase())) errors.add("Duplicate student ID in the file.");
            else if (repository.numberExists(n, semesterId)) errors.add("Student ID already exists.");
        }

        return new ImportRow(line, orRaw(n, number), orRaw(l, last), orRaw(f, first), orRaw(m, mi),
                orRaw(g, gender), orRaw(y, year), orRaw(c, course), errors);
    }

    private String orRaw(String normalised, String raw) {
        return normalised != null ? normalised : clean(raw);
    }

    private String attempt(List<String> errors, java.util.function.Supplier<String> check) {
        try {
            return check.get();
        } catch (Invalid e) {
            errors.add(e.getMessage());
            return null;
        }
    }

    private List<List<String>> readTable(MultipartFile file) throws Exception {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
            try (InputStream in = file.getInputStream(); Workbook wb = WorkbookFactory.create(in)) {
                Sheet sheet = wb.getSheetAt(0);
                DataFormatter fmt = new DataFormatter();
                List<List<String>> out = new ArrayList<>();
                int cols = 0;
                for (Row r : sheet) {
                    cols = Math.max(cols, r.getLastCellNum());
                }
                for (Row r : sheet) {
                    List<String> cells = new ArrayList<>();
                    for (int c = 0; c < cols; c++) {
                        Cell cell = r.getCell(c);
                        if (cell == null) { cells.add(""); continue; }
                        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
                            cells.add(cell.getLocalDateTimeCellValue().toLocalDate().toString());
                        } else {
                            cells.add(fmt.formatCellValue(cell));
                        }
                    }
                    out.add(cells);
                }
                return out;
            }
        }
        String text = new String(file.getBytes(), StandardCharsets.UTF_8);
        if (text.startsWith("\uFEFF")) text = text.substring(1);
        return parseCsv(text);
    }

    /** Maliit na CSV parser na sumusuporta sa quotes at comma sa loob ng cell */
    private List<List<String>> parseCsv(String text) {
        List<List<String>> rows = new ArrayList<>();
        List<String> row = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean quoted = false;

        for (int i = 0; i < text.length(); i++) {
            char ch = text.charAt(i);
            if (quoted) {
                if (ch == '"') {
                    if (i + 1 < text.length() && text.charAt(i + 1) == '"') { cur.append('"'); i++; }
                    else quoted = false;
                } else cur.append(ch);
            } else if (ch == '"') {
                quoted = true;
            } else if (ch == ',') {
                row.add(cur.toString()); cur.setLength(0);
            } else if (ch == '\n' || ch == '\r') {
                if (ch == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
                row.add(cur.toString()); cur.setLength(0);
                rows.add(row); row = new ArrayList<>();
            } else cur.append(ch);
        }
        if (cur.length() > 0 || !row.isEmpty()) { row.add(cur.toString()); rows.add(row); }
        return rows;
    }

    private Map<String, Integer> mapHeader(List<String> header) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < header.size(); i++) {
            String h = header.get(i) == null ? "" : header.get(i).toLowerCase().replaceAll("[^a-z]", "");
            String key = switch (h) {
                case "studentnumber", "studentno", "studentid", "idnumber", "id" -> "studentNumber";
                case "lastname", "surname" -> "lastname";
                case "firstname", "givenname" -> "firstname";
                case "middleinitial", "mi" -> "middleInitial";
                case "gender", "sex" -> "gender";
                case "year", "yearlevel", "studentyear" -> "year";
                case "course", "program", "subject", "subjectcode", "coursecode" -> "course";
                case "contact", "contactnumber", "phone", "mobile" -> "contact";
                case "email", "emailaddress" -> "email";
                case "birthday", "birthdate", "dateofbirth" -> "birthday";
                case "address" -> "address";
                default -> null;
            };
            if (key != null) map.putIfAbsent(key, i);
        }
        return map;
    }

    private String headerLabel(String key) {
        return switch (key) {
            case "studentNumber" -> "Student ID";
            case "lastname" -> "Lastname";
            case "firstname" -> "Firstname";
            case "gender" -> "Gender";
            case "email" -> "Email";
            default -> key;
        };
    }

    private String cell(List<String> cells, Map<String, Integer> col, String key) {
        Integer i = col.get(key);
        return i == null || i >= cells.size() ? "" : cells.get(i);
    }

    // ---------------------------------------------------------------------
    // Validators (nagbabalik ng nilinis na halaga o nagtatapon ng Invalid)
    // ---------------------------------------------------------------------

    private String validNumber(String raw) {
        String v = clean(raw);
        if (v.isEmpty()) throw new Invalid("Student number is required.");
        if (!NUMBER.matcher(v).matches()) throw new Invalid("Student number can only have letters, numbers, - and /.");
        return v;
    }

    private String validName(String raw, String label) {
        String v = clean(raw);
        if (v.isEmpty()) throw new Invalid(label + " is required.");
        if (v.length() > 100) throw new Invalid(label + " is too long (max 100 characters).");
        return v;
    }

    private String validInitial(String raw) {
        String v = clean(raw).replace(".", "");
        if (v.isEmpty()) return null;
        if (v.length() > 3) throw new Invalid("Middle initial is too long.");
        return v.toUpperCase();
    }

    private String validGender(String raw) {
        String v = clean(raw).toLowerCase();
        if (v.isEmpty()) throw new Invalid("Gender is required.");
        if (v.equals("male") || v.equals("m")) return "Male";
        if (v.equals("female") || v.equals("f")) return "Female";
        throw new Invalid("Gender must be Male or Female.");
    }

    private String validYear(String raw) {
        String v = clean(raw).toLowerCase();
        if (v.isEmpty()) return null;
        String digit = v.replaceAll("[^0-9]", "");
        if (digit.length() == 1 && "12345".contains(digit)) {
            return switch (digit) {
                case "1" -> "1st Year";
                case "2" -> "2nd Year";
                case "3" -> "3rd Year";
                case "4" -> "4th Year";
                default -> "5th Year";
            };
        }
        throw new Invalid("Year must be 1st to 5th Year.");
    }

    private String validContact(String raw) {
        String v = clean(raw);
        if (v.isEmpty()) return null;
        if (!PHONE.matcher(v).matches()) throw new Invalid("Enter a valid contact number.");
        return v;
    }

    private String validEmail(String raw) {
        String v = clean(raw).toLowerCase();
        if (v.isEmpty()) throw new Invalid("Email is required.");
        if (v.length() > 255 || !EMAIL.matcher(v).matches()) throw new Invalid("Enter a valid email.");
        return v;
    }

    private String validBirthday(String raw) {
        String v = clean(raw);
        if (v.isEmpty()) return null;
        LocalDate d = null;
        for (DateTimeFormatter f : List.of(DateTimeFormatter.ISO_LOCAL_DATE,
                DateTimeFormatter.ofPattern("M/d/yyyy"))) {
            try { d = LocalDate.parse(v, f); break; } catch (DateTimeParseException ignored) { }
        }
        if (d == null) throw new Invalid("Birthday must look like 2003-05-14.");
        if (d.getYear() < 1950 || d.isAfter(LocalDate.now())) throw new Invalid("Birthday is out of range.");
        return d.toString();
    }

    private String validCourse(String raw) {
        String v = clean(raw);
        if (v.isEmpty()) return null;
        if (v.length() > 50) throw new Invalid("Course is too long (max 50 characters).");
        return v;
    }

    private String validShortText(String raw, String label) {
        String v = clean(raw);
        if (v.isEmpty()) return null;
        if (v.length() > 255) throw new Invalid(label + " is too long (max 255 characters).");
        return v;
    }

    private String validAddress(String raw) {
        String v = clean(raw);
        if (v.isEmpty()) return null;
        if (v.length() > 255) throw new Invalid("Address is too long (max 255 characters).");
        return v;
    }

    // ---------------------------------------------------------------------
    // Iba pang helper
    // ---------------------------------------------------------------------

    private Student build(Coordinator coordinator, Long semesterId, String number, String last,
                          String first, String mi, String gender, String year, String course) {
        Student s = new Student();
        s.setCoordinator(coordinator);
        s.setSemester(em.getReference(Semester.class, semesterId));
        s.setSubjectCode(course != null ? course : subjectCodeFor(coordinator, semesterId));
        s.setStudentNumber(number);
        s.setLastname(last);
        s.setFirstname(first);
        s.setMiddleInitial(mi);
        s.setGender(gender);
        s.setYear(year);
        // Walang email o password hangga't hindi nagc-claim ang student sa QR
        s.setPassword(unusablePassword());
        s.setIsVerified(false);
        s.setIsArchived(false);
        s.setMustChangePassword(false);
        return s;
    }

    /** Random na hash na hindi malalaman ninuman; hindi makakapag-login hangga't hindi nagc-claim */
    private String unusablePassword() {
        // 32 hex characters lang: hindi lalampas sa 72-byte limit ng BCrypt
        return passwordEncoder.encode(UUID.randomUUID().toString().replace("-", ""));
    }

    private boolean hasAccount(Student s) {
        return s.getEmail() != null && !s.getEmail().isBlank();
    }

    /** Ang pinakakaraniwang subject code ng coordinator sa semester; kung wala, abbreviation ng program */
    private String subjectCodeFor(Coordinator coordinator, Long semesterId) {
        List<?> found = em.createQuery(
                        "select s.subjectCode from Student s where s.coordinator.id = :c and s.semester.id = :sem "
                                + "group by s.subjectCode order by count(s) desc")
                .setParameter("c", coordinator.getId())
                .setParameter("sem", semesterId)
                .setMaxResults(1)
                .getResultList();
        if (!found.isEmpty() && found.get(0) != null) return found.get(0).toString();
        Program p = coordinator.getProgram();
        return p != null && p.getAbbreviation() != null ? p.getAbbreviation() : "OJT";
    }

    private StudentRow toRow(Student s) {
        Department d = s.getDepartment();
        Company c = d == null ? null : d.getCompany();
        return new StudentRow(
                s.getId(), s.getStudentNumber(), s.getLastname(), s.getFirstname(), s.getMiddleInitial(),
                s.getGender(), s.getYear(), s.getContact(), s.getEmail(), s.getBirthday(), s.getAddress(),
                s.getSubjectCode(), s.getStatus(), Boolean.TRUE.equals(s.getIsArchived()),
                c == null ? null : c.getName(), d == null ? null : d.getName(),
                hasAccount(s));
    }

    private boolean owns(Coordinator coordinator, Student s) {
        return s.getCoordinator() != null && s.getCoordinator().getId().equals(coordinator.getId());
    }

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }

    private String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }
}
