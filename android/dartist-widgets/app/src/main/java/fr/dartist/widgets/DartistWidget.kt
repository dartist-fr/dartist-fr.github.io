package fr.dartist.widgets

import android.content.Context
import android.graphics.Color as AndroidColor
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.glance.GlanceComposable
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.text.FontFamily
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.unit.dp
import androidx.glance.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class DartistGlanceWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val appWidgetId = GlanceAppWidgetManager(context).getAppWidgetId(id)
        val prefs = context.getSharedPreferences(DartistWidgetReceiver.PREFS, Context.MODE_PRIVATE)
        val raw = prefs.getString(
            DartistWidgetReceiver.widgetKey(appWidgetId),
            prefs.getString(DartistWidgetReceiver.PENDING_CONFIG, null)
        )
        val config = WidgetConfig.fromJson(raw)
        provideContent { DartistWidgetContent(config) }
    }
}

@Composable
@GlanceComposable
private fun DartistWidgetContent(config: WidgetConfig) {
    val light = config.theme.equals("light", ignoreCase = true)
    val background = if (light) 0xFFE7EBF0.toInt() else 0xFF18232A.toInt()
    val accent = parseColor(config.accent, 0xFF55DFB6.toInt())
    val text = if (light) 0xFF17232B.toInt() else AndroidColor.WHITE
    val muted = if (light) 0xFF596775.toInt() else 0xFFC2CDD3.toInt()

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ColorProvider(Color(background)))
            .cornerRadius(config.radius.coerceIn(8, 34).dp)
            .padding(15.dp)
    ) {
        Text(
            text = config.title.ifBlank { config.modelName.uppercase(Locale.getDefault()) },
            style = TextStyle(
                color = ColorProvider(Color(muted)),
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                fontFamily = FontFamily.Monospace
            )
        )
        Text(
            text = widgetValue(config.modelId),
            style = TextStyle(
                color = ColorProvider(Color(accent)),
                fontSize = if (config.format == "2x4" || config.format == "4x4") 38.sp else 32.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = fontFamilyFor(config.timeFont)
            )
        )
        if (config.showDate) {
            Text(
                text = widgetDetail(config.modelId),
                style = TextStyle(
                    color = ColorProvider(Color(text)),
                    fontSize = 10.sp,
                    fontFamily = FontFamily.SansSerif
                )
            )
        }
    }
}

private fun fontFamilyFor(name: String): FontFamily = when (name.lowercase(Locale.ROOT)) {
    "share tech mono", "ibm plex mono", "orbitron", "oxanium", "chakra petch" -> FontFamily.Monospace
    "bebas neue", "rajdhani", "exo 2" -> FontFamily("sans-serif-condensed")
    "playfair display" -> FontFamily.Serif
    else -> FontFamily.SansSerif
}

private fun widgetValue(id: String): String {
    val now = Date()
    return when (id) {
        "clock", "clock-neon", "clock-minimal", "clock-flip", "clock-seconds", "analog" ->
            SimpleDateFormat(if (id == "clock-seconds") "HH:mm:ss" else "HH:mm", Locale.getDefault()).format(now)
        "calendar", "calendar-week", "date-large", "birthdays" ->
            SimpleDateFormat("dd", Locale.getDefault()).format(now)
        "weather", "weather-week", "humidity", "air-quality" -> "21°"
        "battery", "battery-ring", "battery-saver" -> "82%"
        "music", "music-cover", "music-equalizer", "music-controls" -> "♫"
        "steps", "steps-ring" -> "6 842"
        "heart-rate" -> "72 bpm"
        "calories" -> "420 kcal"
        "distance", "running" -> "5,2 km"
        "earbuds", "earbuds-case", "earbuds-charges" -> "L 96% · R 92%"
        "watch", "watch-face" -> "10:08"
        "dual-time" -> "09:41 · 03:41"
        "world-clock" -> "09:41 · 08:41 · 17:41"
        "countdown", "interval-timer" -> "24 DAYS"
        "stopwatch" -> "00:24:38"
        "alarm" -> "07:30"
        "calculator" -> "0"
        "sunrise" -> "06:48 / 18:12"
        "moon-phase" -> "◐"
        "screentime" -> "3h 24m"
        else -> "09:41"
    }
}

private fun widgetDetail(id: String): String {
    val today = SimpleDateFormat("EEEE d MMMM", Locale.getDefault()).format(Date())
    return when (id) {
        "clock", "clock-neon", "clock-minimal", "clock-flip", "clock-seconds", "analog" -> today
        "calendar", "calendar-week", "date-large" -> SimpleDateFormat("MMMM yyyy", Locale.getDefault()).format(Date())
        "weather", "weather-week" -> "Exemple visuel · météo non connectée"
        "battery", "battery-ring", "battery-saver" -> "Batterie indicative · démo"
        "steps", "steps-ring", "heart-rate", "calories", "distance", "running" -> "Exemple · Health Connect non connecté"
        "music", "music-cover", "music-equalizer", "music-controls" -> "Lecteur audio non connecté"
        "earbuds", "earbuds-case", "earbuds-charges" -> "Exemple · appareil non connecté"
        "dual-time", "world-clock" -> "Heures d’exemple"
        else -> "Widget Dartist"
    }
}

private fun parseColor(hex: String, fallback: Int): Int =
    try { AndroidColor.parseColor(hex) } catch (_: Exception) { fallback }
