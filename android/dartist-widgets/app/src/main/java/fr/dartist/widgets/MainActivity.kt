package fr.dartist.widgets

import android.app.Activity
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private var importedJson: String = ""
    private var importedConfig: WidgetConfig = WidgetConfig()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        receiveConfiguration(intent)
        showScreen()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        receiveConfiguration(intent)
        showScreen()
    }

    private fun receiveConfiguration(source: Intent?) {
        if (source == null || source.action != Intent.ACTION_SEND) return
        val uri = getSharedUri(source)
        val raw = try {
            when {
                uri != null -> contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
                !source.getStringExtra(Intent.EXTRA_TEXT).isNullOrBlank() -> source.getStringExtra(Intent.EXTRA_TEXT)
                else -> null
            }
        } catch (_: Exception) {
            null
        }

        if (raw.isNullOrBlank()) {
            Toast.makeText(this, "Le fichier de configuration n’a pas pu être lu.", Toast.LENGTH_LONG).show()
            return
        }

        importedJson = raw
        importedConfig = WidgetConfig.fromJson(raw)
        getSharedPreferences(DartistWidgetReceiver.PREFS, MODE_PRIVATE)
            .edit()
            .putString(DartistWidgetReceiver.PENDING_CONFIG, raw)
            .apply()
    }

    @Suppress("DEPRECATION")
    private fun getSharedUri(source: Intent): Uri? {
        source.clipData?.let { clip ->
            if (clip.itemCount > 0) clip.getItemAt(0).uri?.let { return it }
        }
        return if (Build.VERSION.SDK_INT >= 33) {
            source.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
        } else {
            source.getParcelableExtra(Intent.EXTRA_STREAM)
        }
    }

    private fun showScreen() {
        val outer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(26), dp(34), dp(26), dp(28))
            setBackgroundColor(android.graphics.Color.rgb(9, 11, 16))
        }

        val brand = TextView(this).apply {
            text = "dartist."
            textSize = 27f
            setTextColor(android.graphics.Color.rgb(85, 223, 182))
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.BOLD)
        }
        outer.addView(brand, matchWrap())

        val heading = TextView(this).apply {
            text = if (importedJson.isBlank()) "Tes widgets, sur ton écran." else importedConfig.modelName
            textSize = 23f
            setTextColor(android.graphics.Color.WHITE)
            typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD)
            setPadding(0, dp(30), 0, dp(8))
        }
        outer.addView(heading, matchWrap())

        val description = TextView(this).apply {
            text = if (importedJson.isBlank()) {
                "Partage un widget depuis le Studio Dartist pour le préparer ici, puis ajoute-le à ton écran d’accueil."
            } else {
                "Configuration reçue : ${importedConfig.title}\nStyle : ${importedConfig.timeFont}\nFormat : ${importedConfig.format}"
            }
            textSize = 14f
            setTextColor(android.graphics.Color.rgb(174, 184, 202))
            setLineSpacing(dp(4).toFloat(), 1f)
        }
        outer.addView(description, matchWrap())

        val add = Button(this).apply {
            text = "Ajouter à l’écran d’accueil"
            isEnabled = importedJson.isNotBlank()
            setOnClickListener { requestPin() }
        }
        outer.addView(add, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(54)
        ).apply { topMargin = dp(30) })

        val manual = Button(this).apply {
            text = "Ouvrir les widgets Android"
            setOnClickListener {
                Toast.makeText(
                    this@MainActivity,
                    "Maintiens ton doigt sur l’écran d’accueil, puis ouvre Widgets > Dartist Widgets.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
        outer.addView(manual, LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(48)
        ).apply { topMargin = dp(10) })

        val footnote = TextView(this).apply {
            text = "Android affiche une confirmation avant l’ajout. Selon le launcher, l’ajout direct peut ne pas être disponible."
            textSize = 11f
            setTextColor(android.graphics.Color.rgb(112, 126, 148))
            setPadding(0, dp(24), 0, 0)
        }
        outer.addView(footnote, matchWrap())
        setContentView(outer)
    }

    private fun requestPin() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            Toast.makeText(this, "L’ajout direct nécessite Android 8 ou supérieur.", Toast.LENGTH_LONG).show()
            return
        }

        val manager = AppWidgetManager.getInstance(this)
        if (!manager.isRequestPinAppWidgetSupported) {
            Toast.makeText(
                this,
                "Ton launcher ne prend pas en charge l’ajout direct. Utilise Widgets > Dartist Widgets.",
                Toast.LENGTH_LONG
            ).show()
            return
        }

        val callbackIntent = Intent(this, WidgetPinnedReceiver::class.java).apply {
            action = WidgetPinnedReceiver.ACTION_WIDGET_PINNED
            putExtra(WidgetPinnedReceiver.EXTRA_CONFIG_JSON, importedJson)
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or
            if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0
        val callback = PendingIntent.getBroadcast(
            this,
            System.currentTimeMillis().toInt(),
            callbackIntent,
            flags
        )

        val accepted = manager.requestPinAppWidget(
            ComponentName(this, DartistWidgetReceiver::class.java),
            null,
            callback
        )

        if (!accepted) {
            Toast.makeText(
                this,
                "Le launcher a refusé la demande. Ajoute Dartist Widgets depuis le menu Widgets.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun matchWrap() = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
    )
}
