package com.drivefix.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin local: huella / passkey nativa (NativePasskeyPlugin).
        registerPlugin(NativePasskeyPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
