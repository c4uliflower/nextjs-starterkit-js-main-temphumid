<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('system_menus', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->string('type', 20); // 'header', 'group', 'item'
            $table->string('title', 100);
            $table->string('icon', 50)->nullable(); // Lucide icon names
            $table->string('path', 255)->nullable(); // URL path for 'item' types
            $table->string('permission_key', 100)->nullable(); // e.g., 'dci.view', 'dci.create'
            $table->integer('display_order')->default(0);
            $table->boolean('is_active')->default(true);

            // Timestamps and blameable
            $table->timestamps();
            $table->softDeletes();
            $table->string('created_by', 255)->nullable();
            $table->string('updated_by', 255)->nullable();
            $table->string('deleted_by', 255)->nullable();

            // Indexes (no foreign key to avoid SQL Server cascade path issues)
            $table->index('parent_id');
            $table->index(['type', 'is_active']);
            $table->index('display_order');
            $table->index('permission_key');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_menus');
    }
};
