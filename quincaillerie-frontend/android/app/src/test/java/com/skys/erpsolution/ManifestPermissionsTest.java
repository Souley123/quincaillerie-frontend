package com.skys.erpsolution;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertThrows;

import org.junit.BeforeClass;
import org.junit.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Garde-fou sur le manifeste Android, qui est édité À LA MAIN.
 *
 * Capacitor ne régénère pas AndroidManifest.xml lors d'un `cap sync`
 * (seulement à la création du projet), et capacitor.config.json n'offre
 * aucune clé pour déclarer des permissions. La copie présente dans
 * {@code src/test/resources} sert de référence : si une permission ou un
 * réglage de sécurité disparaît du manifeste réel lors d'une manipulation,
 * ce test le signale.
 */
public class ManifestPermissionsTest {

    private static final String MANIFESTE = "AndroidManifest.xml";

    /**
     * Manifeste réellement compilé, relatif au répertoire du module Gradle
     * {@code android/app} (répertoire de travail par défaut des tests).
     */
    private static final Path MANIFESTE_REEL = Paths.get("src", "main", MANIFESTE);

    /**
     * Contenu du manifeste, lu une seule fois à l'initialisation de la classe.
     * {@code final} : aucune méthode ne peut le remplacer ni le remettre à
     * {@code null} après coup.
     */
    private static final String MANIFESTE_CONTENU = lireManifeste();

    /**
     * Même contenu, mais avec les espaces/sauts de ligne entre le nom d'un
     * attribut, le {@code =} et sa valeur supprimés. Permet aux vérifications
     * de présence de texte de ne pas dépendre de la mise en forme du fichier.
     */
    private static final String MANIFESTE_NORMALISE = normaliser(MANIFESTE_CONTENU);

    /** {@code attribut = "valeur"} (espaces optionnels) -> {@code attribut="valeur"}. */
    private static final Pattern ESPACES_AUTOUR_EGAL = Pattern.compile("(\\w|:|\\})\\s*=\\s*\"");

    /**
     * Les deux constantes ci-dessus sont initialisées au chargement de la
     * classe ; ce garde-fou transforme un éventuel échec silencieux (valeur
     * inattendue) en message explicite plutôt qu'en {@code NullPointerException}
     * obscure dans une assertion.
     */
    @BeforeClass
    public static void verifierManifesteCharge() {
        if (MANIFESTE_CONTENU == null || MANIFESTE_CONTENU.trim().isEmpty()) {
            throw new IllegalStateException("Contenu du manifeste vide ou non lu pour "
                    + MANIFESTE_REEL.toAbsolutePath());
        }
        if (MANIFESTE_NORMALISE == null || MANIFESTE_NORMALISE.trim().isEmpty()) {
            throw new IllegalStateException("Manifeste normalisé vide alors que "
                    + MANIFESTE + " a été lu (" + MANIFESTE_CONTENU.length() + " caractères)");
        }
    }

    /**
     * Normalise le manifeste pour que {@code doitContenir} ignorent la mise en
     * forme : les espaces autour du {@code =} des attributs sont supprimés et
     * les fins de ligne sont converties en espaces simples.
     */
    private static String normaliser(String contenu) {
        String sansFinDeLigne = contenu.replace("\r\n", " ").replace("\n", " ").replace("\r", " ");
        return ESPACES_AUTOUR_EGAL.matcher(sansFinDeLigne).replaceAll("$1=\"");
    }

    private static String lireManifeste() throws IOException {
        if (Files.isRegularFile(MANIFESTE_REEL)) {
            return new String(Files.readAllBytes(MANIFESTE_REEL), StandardCharsets.UTF_8);
        }

        // Secours : copie de référence, utilisée uniquement si le manifeste
        // réel n'est pas atteignable depuis le répertoire de travail.
        InputStream flux = ManifestPermissionsTest.class
                .getClassLoader().getResourceAsStream(MANIFESTE);
        if (flux == null) {
            throw new AssertionError("Manifeste introuvable : ni "
                    + MANIFESTE_REEL.toAbsolutePath()
                    + " ni la copie de src/test/resources/" + MANIFESTE);
        }
        try (InputStream entree = flux) {
            return new String(entree.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void doitContenir(String extrait) {
        assertTrue("Attendu dans " + MANIFESTE + " : " + extrait,
                MANIFESTE_NORMALISE.contains(normaliser(extrait)));
    }

    /**
     * Vérifie que la balise {@code <uses-feature>} portant ce {@code android:name}
     * déclare {@code android:required="false"}, sans dépendre de l'ordre des
     * attributs ni des espaces/sauts de ligne de la mise en forme.
     */
    private static void doitEtreOptionnelle(String nomFonctionnalite) {
        verifierFonctionnaliteOptionnelle(MANIFESTE_CONTENU, nomFonctionnalite);
    }

    /**
     * Version pure de {@link #doitEtreOptionnelle(String)} : travaille sur le
     * texte fourni plutôt que sur le manifeste chargé, ce qui permet de la
     * tester avec des entrées malformées.
     */
    private static void verifierFonctionnaliteOptionnelle(String contenu, String nomFonctionnalite) {
        boolean trouvee = false;
        for (String balise : findOpeningTags(contenu, "uses-feature")) {
            if (!nomFonctionnalite.equals(getAttribute(balise, "android:name"))) {
                continue;
            }
            trouvee = true;
            String requis = getAttribute(balise, "android:required");
            assertNotNull("Attribut android:required manquant pour " + nomFonctionnalite, requis);
            assertEquals(
                    nomFonctionnalite + " doit rester optionnelle à l'installation",
                    "false",
                    requis);
        }
        assertTrue("Balise uses-feature absente pour " + nomFonctionnalite, trouvee);
    }

    /**
     * Retourne la valeur de l'attribut donné sur la balise d'ouverture
     * {@code <application>}, ou {@code null} s'il est absent.
     */
    private static String attributApplication(String attribut) {
        return attributSurBaliseApplication(MANIFESTE_CONTENU, attribut);
    }

    /**
     * Version pure de {@link #attributApplication(String)} : retourne la valeur
     * de l'attribut sur la balise d'ouverture {@code <application>} du texte
     * fourni, ou {@code null} s'il est absent. Échoue si la balise manque.
     */
    private static String attributSurBaliseApplication(String contenu, String attribut) {
        Matcher application = Pattern.compile("<application\\b[^>]*>").matcher(contenu);
        assertTrue("Balise <application> absente de " + MANIFESTE, application.find());
        return getAttribute(application.group(), attribut);
    }

    /**
     * Retourne la balise d'ouverture {@code <tagName ...>} : recherche toutes
     * les occurrences du texte fourni, dans l'ordre du document.
     */
    private static List<String> findOpeningTags(String contenu, String tagName) {
        Matcher balise = Pattern.compile("<" + Pattern.quote(tagName) + "\\b[^>]*>").matcher(contenu);
        List<String> balises = new ArrayList<>();
        while (balise.find()) {
            balises.add(balise.group());
        }
        return balises;
    }

    /**
     * Retourne la valeur de l'attribut donné dans la balise fournie, ou
     * {@code null} s'il est absent. Le nom doit correspondre entier : la
     * recherche est précédée d'une limite de nom (début, espace, {@code <}).
     */
    private static String getAttribute(String balise, String attribut) {
        Matcher valeur = Pattern
                .compile("(?:^|[\\s<])" + Pattern.quote(attribut) + "\\s*=\\s*\"([^\"]*)\"")
                .matcher(balise);
        return valeur.find() ? valeur.group(1) : null;
    }

    @Test
    public void permissionsMetier_sontDeclarees() {
        doitContenir("android.permission.INTERNET");
        doitContenir("android.permission.CAMERA");
        doitContenir("android.permission.ACCESS_NETWORK_STATE");
        doitContenir("android.permission.VIBRATE");
    }

    @Test
    public void camera_resteOptionnelleALInstallation() {
        // Sinon l'app disparaît du Play Store pour les appareils sans caméra.
        doitEtreOptionnelle("android.hardware.camera");
        doitEtreOptionnelle("android.hardware.camera.autofocus");
    }

    @Test
    public void sauvegarde_desactivee() {
        assertEquals("allowBackup doit rester à false", "false", attributApplication("android:allowBackup"));
        doitContenir("android:dataExtractionRules=\"@xml/data_extraction_rules\"");
        doitContenir("android:fullBackupContent=\"@xml/backup_rules\"");
    }

    @Test
    public void fileProvider_present() {
        doitContenir("androidx.core.content.FileProvider");
        doitContenir("${applicationId}.fileprovider");
    }

    @Test
    public void manifesteReference_resteAligneSurLeManifesteReel() throws IOException {
        // La copie de src/test/resources sert de secours : si elle diverge du
        // manifeste réel, un test peut passer en local et échouer en CI (ou
        // inversement). On compare les deux normalisations.
        InputStream flux = ManifestPermissionsTest.class
                .getClassLoader()
                .getResourceAsStream("AndroidManifest.xml");
        if (flux == null) {
            return; // copie absente : lireManifeste() a déjà validé le manifeste réel.
        }
        String reference;
        try (InputStream entree = flux) {
            reference = new String(entree.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertEquals(
                "src/test/resources/AndroidManifest.xml a divergé du manifeste réel",
                normaliser(MANIFESTE_CONTENU),
                normaliser(reference));
    }

    @Test
    public void gardeFou_echoueSurUnExtraitAbsent() {
        // Preuve que le helper d'assertion détecte réellement une régression.
        assertThrows(AssertionError.class,
                () -> doitContenir("android.permission.NE_DOIT_PAS_EXISTER"));
    }

    // --- Tests des helpers purs, sur des entrées malformées -------------

    @Test
    public void optionnelle_true_estRejetee() {
        String manifesteFautif = "<manifest><uses-feature android:name=\"android.hardware.camera\" "
                + "android:required=\"true\" /></manifest>";
        assertThrows(AssertionError.class,
                () -> verifierFonctionnaliteOptionnelle(manifesteFautif, "android.hardware.camera"));
    }

    @Test
    public void optionnelle_required_absent_estRejete() {
        String manifesteFautif = "<manifest><uses-feature android:name=\"android.hardware.camera\" "
                + "android:version=\"1\" /></manifest>";
        assertThrows(AssertionError.class,
                () -> verifierFonctionnaliteOptionnelle(manifesteFautif, "android.hardware.camera"));
    }

    @Test
    public void optionnelle_balise_absente_estRejetee() {
        String manifesteFautif = "<manifest><uses-feature android:name=\"android.hardware.camera\" "
                + "android:required=\"false\" /></manifest>";
        assertThrows(AssertionError.class,
                () -> verifierFonctionnaliteOptionnelle(manifesteFautif, "android.hardware.camera.autofocus"));
    }

    @Test
    public void optionnelle_balise_nonFermee_resteDetectee() {
        // Ni '>' ni '/>' : la regex ne peut pas capturer la balise complète.
        String manifesteFautif = "<manifest><uses-feature android:name=\"android.hardware.camera\" "
                + "android:required=\"false\"</manifest>";
        assertThrows(AssertionError.class,
                () -> verifierFonctionnaliteOptionnelle(manifesteFautif, "android.hardware.camera"));
    }

    @Test
    public void optionnelle_ordreDesAttributs_etEspaces_acceptes() {
        String manifesteValide = "<manifest>\n    <uses-feature\n        android:required = \"false\"\n"
                + "        android:name=\"android.hardware.camera\" />\n</manifest>";
        verifierFonctionnaliteOptionnelle(manifesteValide, "android.hardware.camera");
    }

    @Test
    public void attributApplication_absent_retourneNull() {
        String manifesteSansAllowBackup = "<manifest><application android:label=\"Quincaillerie\">"
                + "</application></manifest>";
        assertNull(attributSurBaliseApplication(manifesteSansAllowBackup, "android:allowBackup"));
    }

    @Test
    public void attributApplication_baliseAbsente_echoue() {
        String manifesteSansApplication = "<manifest><uses-permission "
                + "android:name=\"android.permission.INTERNET\"/></manifest>";
        assertThrows(AssertionError.class,
                () -> attributSurBaliseApplication(manifesteSansApplication, "android:allowBackup"));
    }

    @Test
    public void attributApplication_neConfondPasPrefixe() {
        // 'android:allowBackupExtra' ne doit pas répondre à 'android:allowBackup'.
        String manifestePiege = "<manifest><application android:allowBackupExtra=\"true\" "
                + "android:label=\"Q\"></application></manifest>";
        assertNull(attributSurBaliseApplication(manifestePiege, "android:allowBackup"));
    }

    @Test
    public void attributApplication_valeurSurPlusieursLignes_estLue() {
        String manifesteIndente = "<manifest>\n  <application\n    android:allowBackup =\n      \"false\"\n"
                + "    android:label=\"Q\"></application>\n</manifest>";
        assertEquals("false", attributSurBaliseApplication(manifesteIndente, "android:allowBackup"));
    }
}
