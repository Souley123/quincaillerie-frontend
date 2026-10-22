package com.skys.erpsolution;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Vérifie la cohérence entre la configuration Capacitor embarquée
 * ({@code assets/capacitor.config.json}) et le build Android.
 *
 * Le fichier est lu depuis {@code src/test/resources}, où une copie de
 * référence est maintenue : {@code assets/} n'est pas dans le classpath des
 * tests unitaires JVM.
 *
 * {@code org.json} n'est pas disponible sur le JVM (stub Android uniquement),
 * on extrait donc les valeurs par expression régulière.
 */
public class ExampleUnitTest {

    private static final String CONFIG = "capacitor.config.json";

    /** Identifiant de l'application, doit correspondre à applicationId du build.gradle. */
    private static final String APPLICATION_ID = "com.skys.erpsolution";

    private static String lireConfig() throws IOException {
        try (InputStream flux = ExampleUnitTest.class.getClassLoader().getResourceAsStream(CONFIG)) {
            assertNotNull("capacitor.config.json introuvable dans src/test/resources", flux);
            java.io.ByteArrayOutputStream tampon = new java.io.ByteArrayOutputStream();
            byte[] bloc = new byte[4096];
            int lus;
            while ((lus = flux.read(bloc)) != -1) {
                tampon.write(bloc, 0, lus);
            }
            return tampon.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static String extraire(String json, String cle) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(cle) + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        assertTrue("Clé \"" + cle + "\" absente de " + CONFIG, m.find());
        return m.group(1);
    }

    private static boolean extraireBooleen(String json, String cle) {
        Matcher m = Pattern.compile("\"" + Pattern.quote(cle) + "\"\\s*:\\s*(true|false)").matcher(json);
        assertTrue("Clé booléenne \"" + cle + "\" absente de " + CONFIG, m.find());
        return Boolean.parseBoolean(m.group(1));
    }

    @Test
    public void appId_correspondA_ApplicationId() throws IOException {
        assertEquals(APPLICATION_ID, extraire(lireConfig(), "appId"));
    }

    @Test
    public void webDir_estDist() throws IOException {
        assertEquals("dist", extraire(lireConfig(), "webDir"));
    }

    @Test
    public void schemeAndroid_estHttps() throws IOException {
        // Un schéma autre que https casse les API Web de contexte sécurisé
        // (getUserMedia, clipboard) utilisées par le scanner et la caméra.
        assertEquals("https", extraire(lireConfig(), "androidScheme"));
    }

    @Test
    public void requetesEnClair_sontInterdites() throws IOException {
        String json = lireConfig();
        assertFalse("allowCleartext doit rester false", extraireBooleen(json, "allowCleartext"));
        assertFalse("allowMixedContent doit rester false", extraireBooleen(json, "allowMixedContent"));
    }

    @Test
    public void debugWebView_desactiveHorsDeveloppement() throws IOException {
        assertFalse(extraireBooleen(lireConfig(), "webContentsDebuggingEnabled"));
    }
}
