package com.skys.erpsolution;

import static org.junit.Assert.assertEquals;

import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Instrumented test, which will execute on an Android device.
 *
 * <p>L'assertion s'appuie sur {@link BuildConfig#APPLICATION_ID} plutôt que sur
 * une chaîne littérale : si un {@code applicationIdSuffix} est ajouté (build
 * debug, flavour), le test suit automatiquement et ne casse pas.
 *
 * @see <a href="http://d.android.com/tools/testing">Testing documentation</a>
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    @Test
    public void useAppContext() throws Exception {
        // Context of the app under test.
        Context appContext = InstrumentationRegistry.getInstrumentation().getTargetContext();

        assertEquals(BuildConfig.APPLICATION_ID, appContext.getPackageName());
    }
}
