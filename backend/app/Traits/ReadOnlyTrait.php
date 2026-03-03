<?php

namespace App\Traits;

use LogicException;

trait ReadOnlyTrait
{
    /**
     * Disable save()
     */
    public function save(array $options = [])
    {
        throw new LogicException(static::class.' is read-only.');
    }

    /**
     * Disable delete()
     */
    public function delete()
    {
        throw new LogicException(static::class.' is read-only.');
    }

    /**
     * Disable restore() (for soft deletes)
     */
    public function restore()
    {
        throw new LogicException(static::class.' is read-only.');
    }

    /**
     * Block all write-related model events
     */
    protected static function bootReadOnly()
    {
        static::creating(fn () => throw new LogicException(static::class.' is read-only.'));
        static::updating(fn () => throw new LogicException(static::class.' is read-only.'));
        static::deleting(fn () => throw new LogicException(static::class.' is read-only.'));
        static::restoring(fn () => throw new LogicException(static::class.' is read-only.'));
    }
}
