<?php
// Создайте этот файл в папке с админкой
if (file_exists(__DIR__ . '/debug.log')) {
    echo "<h1>Логи загрузки:</h1>";
    echo "<pre>" . htmlspecialchars(file_get_contents(__DIR__ . '/debug.log')) . "</pre>";
} else {
    echo "Файл логов не найден";
}
?>