package fr.dartist.widgets

import org.json.JSONObject

data class WidgetConfig(
    val modelId: String = "clock",
    val modelName: String = "Horloge digitale",
    val title: String = "MY SPACE",
    val accent: String = "#55DFB6",
    val theme: String = "dark",
    val timeFont: String = "Orbitron",
    val format: String = "2x2",
    val radius: Int = 20,
    val showDate: Boolean = true
) {
    companion object {
        fun fromJson(raw: String?): WidgetConfig {
            if (raw.isNullOrBlank()) return WidgetConfig()
            return try {
                val root = JSONObject(raw)
                val model = root.optJSONObject("model") ?: JSONObject()
                val settings = root.optJSONObject("settings") ?: JSONObject()
                WidgetConfig(
                    modelId = model.optString("id", "clock"),
                    modelName = model.optString("name", "Widget Dartist"),
                    title = settings.optString("title", model.optString("name", "MY SPACE")),
                    accent = settings.optString("accent", "#55DFB6"),
                    theme = settings.optString("theme", "dark"),
                    timeFont = settings.optString("timeFont", "Orbitron"),
                    format = settings.optString("format", "2x2"),
                    radius = settings.optInt("radius", 20).coerceIn(8, 34),
                    showDate = settings.optBoolean("showDate", true)
                )
            } catch (_: Exception) {
                WidgetConfig()
            }
        }
    }
}
