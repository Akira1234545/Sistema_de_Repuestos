package com.drivefix.app;

import android.os.CancellationSignal;
import android.util.Log;

import androidx.core.content.ContextCompat;
import androidx.credentials.CreateCredentialResponse;
import androidx.credentials.CreatePublicKeyCredentialRequest;
import androidx.credentials.CreatePublicKeyCredentialResponse;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.GetPublicKeyCredentialOption;
import androidx.credentials.PublicKeyCredential;
import androidx.credentials.exceptions.CreateCredentialCancellationException;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Huella / passkey nativa (sesión 8). Usa Credential Manager de Android para firmar el desafío
 * WebAuthn que entrega Supabase (Authentication → Passkeys) sin abrir Chrome. El origen que ve
 * Supabase es android:apk-key-hash:… y el dominio se asocia en /.well-known/assetlinks.json.
 */
@CapacitorPlugin(name = "NativePasskey")
public class NativePasskeyPlugin extends Plugin {

    @PluginMethod
    public void register(PluginCall call) {
        String requestJson = call.getString("requestJson");
        if (requestJson == null || requestJson.isEmpty()) {
            call.reject("Falta la solicitud de la passkey", "failed");
            return;
        }

        CredentialManager manager = CredentialManager.create(getContext());
        manager.createCredentialAsync(
            getActivity(),
            new CreatePublicKeyCredentialRequest(requestJson),
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<CreateCredentialResponse, CreateCredentialException>() {
                @Override
                public void onResult(CreateCredentialResponse result) {
                    if (result instanceof CreatePublicKeyCredentialResponse) {
                        JSObject ret = new JSObject();
                        ret.put("response", ((CreatePublicKeyCredentialResponse) result).getRegistrationResponseJson());
                        call.resolve(ret);
                    } else {
                        call.reject("La respuesta no es una passkey", "failed");
                    }
                }

                @Override
                public void onError(CreateCredentialException error) {
                    String code = error instanceof CreateCredentialCancellationException ? "cancelled" : "failed";
                    Log.w("DriveFixPasskey", error.getClass().getSimpleName() + " " + error.getType() + ": " + error.getMessage());
                    call.reject(error.getClass().getSimpleName() + ": " + error.getMessage(), code);
                }
            }
        );
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        String requestJson = call.getString("requestJson");
        if (requestJson == null || requestJson.isEmpty()) {
            call.reject("Falta la solicitud de la passkey", "failed");
            return;
        }

        CredentialManager manager = CredentialManager.create(getContext());
        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(new GetPublicKeyCredentialOption(requestJson))
            .build();

        manager.getCredentialAsync(
            getActivity(),
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(getContext()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    Credential credential = result.getCredential();
                    if (credential instanceof PublicKeyCredential) {
                        JSObject ret = new JSObject();
                        ret.put("response", ((PublicKeyCredential) credential).getAuthenticationResponseJson());
                        call.resolve(ret);
                    } else {
                        Log.w("DriveFixPasskey", "Credencial inesperada: " + credential.getClass().getName() + " " + credential.getType());
                        call.reject("La credencial no es una passkey", "failed");
                    }
                }

                @Override
                public void onError(GetCredentialException error) {
                    String code = error instanceof GetCredentialCancellationException ? "cancelled"
                        : error instanceof NoCredentialException ? "no-credential"
                        : "failed";
                    Log.w("DriveFixPasskey", error.getClass().getSimpleName() + " " + error.getType() + ": " + error.getMessage());
                    call.reject(error.getClass().getSimpleName() + ": " + error.getMessage(), code);
                }
            }
        );
    }
}
